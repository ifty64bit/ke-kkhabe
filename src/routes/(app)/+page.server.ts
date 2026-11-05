import { fail } from '@sveltejs/kit';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { dhakaToday } from '#lib/date.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { breakdownForDay } from '#lib/server/charges.ts';
import { computeLedger } from '#lib/server/ledger.ts';
import { day, dayItem, item, orderLine, response, settlement } from '#lib/server/db/schema.ts';
import { pricePerPiece } from '#lib/quantity.ts';
import { openShares } from '#lib/sharing.ts';
import { parseOrderForm } from '#lib/server/orders.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadToday(db: Db, userId: string) {
	const date = dhakaToday();
	const [today] = await db.select().from(day).where(eq(day.date, date)).limit(1);
	if (!today)
		return {
			date,
			day: null,
			items: [],
			response: null,
			lines: {} as Record<string, number>,
			openShares: {} as Record<string, number>
		};

	const [items, [mine], lines, others] = await Promise.all([
		db
			.select({
				id: item.id,
				name: item.name,
				unitBn: item.unitBn,
				unitEn: item.unitEn,
				available: dayItem.available,
				totalCost: dayItem.totalCost
			})
			.from(dayItem)
			.innerJoin(item, eq(item.id, dayItem.itemId))
			.where(eq(dayItem.dayId, today.id))
			.orderBy(item.name),
		db
			.select({ eating: response.eating })
			.from(response)
			.where(and(eq(response.dayId, today.id), eq(response.userId, userId)))
			.limit(1),
		db
			.select({
				itemId: orderLine.itemId,
				quantity: orderLine.quantity12ths,
				finalQuantity: orderLine.finalQuantity12ths
			})
			.from(orderLine)
			.where(and(eq(orderLine.dayId, today.id), eq(orderLine.userId, userId))),
		// Everyone else's orders, to show halves still open to share.
		db
			.select({
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				quantity: orderLine.quantity12ths
			})
			.from(orderLine)
			.where(and(eq(orderLine.dayId, today.id), ne(orderLine.userId, userId)))
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
		) as Record<string, number>,
		/** Item id to the part others left unclaimed (twelfths), while orders are open. */
		openShares:
			today.status === 'open'
				? Object.fromEntries(openShares(others))
				: ({} as Record<string, number>)
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const meId = locals.user!.id;
	const t = await loadToday(locals.db, meId);
	// The viewer's own balance for the ledger link; the full ledger is computed once, on the server.
	const [breakdown, ledger, [awaitingMe]] = await Promise.all([
		t.day?.status === 'finalized' ? breakdownForDay(locals.db, t.day.id) : Promise.resolve(null),
		computeLedger(locals.db),
		locals.db
			.select({ n: sql<number>`count(*)`.mapWith(Number) })
			.from(settlement)
			.where(
				and(
					eq(settlement.toUserId, meId),
					eq(settlement.status, 'pending'),
					isNull(settlement.voidedAt)
				)
			)
	]);
	const mine = breakdown?.get(meId) ?? null;
	// Twelfths eaten per item that day, to show the per-piece price (total cost ÷ whole items bought).
	const units = mine
		? new Map(
				(
					await locals.db
						.select({
							itemId: orderLine.itemId,
							n: sql<number>`coalesce(sum(${orderLine.finalQuantity12ths}), 0)`.mapWith(Number)
						})
						.from(orderLine)
						.where(eq(orderLine.dayId, t.day!.id))
						.groupBy(orderLine.itemId)
				).map((r) => [r.itemId, r.n])
			)
		: null;
	// Receipt lines: each item the viewer had, its per-piece price and their share of its cost.
	const receipt = mine
		? {
				lines: t.items
					.filter((i) => mine.items.has(i.id))
					.map((i) => ({
						itemId: i.id,
						quantity: t.lines[i.id] ?? 0,
						unitPrice: pricePerPiece(i.totalCost ?? 0, units?.get(i.id) ?? 0),
						amount: mine.items.get(i.id) ?? 0
					})),
				deliveryShare: mine.deliveryShare,
				discountShare: mine.discountShare,
				total: mine.total
			}
		: null;
	return {
		...t,
		charge: mine?.total ?? null,
		receipt,
		myBalance: ledger.balances.get(meId) ?? 0,
		awaitingMeCount: awaitingMe.n
	};
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
		const wanted = parseOrderForm(form, allowed);
		if (!wanted) return fail(400, { messageKey: 'order.error.invalid' as MessageKey });
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
			db.insert(orderLine).values(
				wanted.map((w) => ({
					dayId: today.id,
					userId,
					itemId: w.itemId,
					quantity12ths: w.quantity
				}))
			)
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
