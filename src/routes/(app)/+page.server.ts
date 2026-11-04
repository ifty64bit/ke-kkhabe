import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { dhakaToday } from '#lib/date.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { lineTotal, sum } from '#lib/money.ts';
import { day, dayItem, item, orderLine, response } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

const MAX_QTY = 20;

async function loadToday(db: Db, userId: string) {
	const date = dhakaToday();
	const [today] = await db.select().from(day).where(eq(day.date, date)).limit(1);
	if (!today)
		return { date, day: null, items: [], response: null, lines: {} as Record<string, number> };

	const [items, [mine], lines] = await Promise.all([
		db
			.select({
				id: item.id,
				nameBn: item.nameBn,
				nameEn: item.nameEn,
				unitBn: item.unitBn,
				unitEn: item.unitEn,
				unitPrice: dayItem.unitPrice,
				available: dayItem.available
			})
			.from(dayItem)
			.innerJoin(item, eq(item.id, dayItem.itemId))
			.where(eq(dayItem.dayId, today.id))
			.orderBy(item.nameBn),
		db
			.select({ eating: response.eating })
			.from(response)
			.where(and(eq(response.dayId, today.id), eq(response.userId, userId)))
			.limit(1),
		db
			.select({
				itemId: orderLine.itemId,
				quantity: orderLine.quantity,
				finalQuantity: orderLine.finalQuantity
			})
			.from(orderLine)
			.where(and(eq(orderLine.dayId, today.id), eq(orderLine.userId, userId)))
	]);

	return {
		date,
		day: { id: today.id, status: today.status },
		items,
		response: mine ?? null,
		lines: Object.fromEntries(
			lines.map((l) => [
				l.itemId,
				today.status === 'finalized' ? (l.finalQuantity ?? 0) : l.quantity
			])
		) as Record<string, number>
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const t = await loadToday(locals.db, locals.user!.id);
	const charge =
		t.day?.status === 'finalized'
			? sum(t.items.map((i) => lineTotal(t.lines[i.id] ?? 0, i.unitPrice ?? 0)))
			: null;
	return { ...t, charge };
};

/** Shared preconditions for changing today's answer. */
async function openDay(db: Db) {
	const [today] = await db.select().from(day).where(eq(day.date, dhakaToday())).limit(1);
	if (!today) return { error: fail(409, { messageKey: 'order.error.noMenu' as MessageKey }) };
	if (today.status !== 'open')
		return { error: fail(409, { messageKey: 'order.error.closed' as MessageKey }) };
	return { today };
}

export const actions: Actions = {
	order: async ({ locals, request }) => {
		const db = locals.db;
		const userId = locals.user!.id;
		const { today, error } = await openDay(db);
		if (error) return error;

		const offered = await db
			.select({ itemId: dayItem.itemId })
			.from(dayItem)
			.where(and(eq(dayItem.dayId, today.id), eq(dayItem.available, true)));
		const allowed = new Set(offered.map((o) => o.itemId));

		const form = await request.formData();
		const wanted: { itemId: string; quantity: number }[] = [];
		for (const [key, raw] of form) {
			if (!key.startsWith('qty:')) continue;
			const itemId = key.slice(4);
			const quantity = Number(raw);
			if (!allowed.has(itemId) || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QTY)
				return fail(400, { messageKey: 'order.error.invalid' as MessageKey });
			if (quantity > 0) wanted.push({ itemId, quantity });
		}
		if (wanted.length === 0) return fail(400, { messageKey: 'order.error.empty' as MessageKey });

		await db.batch([
			db
				.insert(response)
				.values({ dayId: today.id, userId, eating: true })
				.onConflictDoUpdate({
					target: [response.dayId, response.userId],
					set: { eating: true, updatedAt: new Date(), addedBy: null }
				}),
			db.delete(orderLine).where(and(eq(orderLine.dayId, today.id), eq(orderLine.userId, userId))),
			db.insert(orderLine).values(wanted.map((w) => ({ dayId: today.id, userId, ...w })))
		]);
		return { saved: 'order' as const };
	},

	skip: async ({ locals }) => {
		const db = locals.db;
		const userId = locals.user!.id;
		const { today, error } = await openDay(db);
		if (error) return error;

		await db.batch([
			db
				.insert(response)
				.values({ dayId: today.id, userId, eating: false })
				.onConflictDoUpdate({
					target: [response.dayId, response.userId],
					set: { eating: false, updatedAt: new Date(), addedBy: null }
				}),
			db.delete(orderLine).where(and(eq(orderLine.dayId, today.id), eq(orderLine.userId, userId)))
		]);
		return { saved: 'skip' as const };
	}
};
