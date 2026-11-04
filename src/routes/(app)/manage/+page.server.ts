import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { dhakaToday } from '#lib/date.ts';
import { formatTaka, type Poisha } from '#lib/money.ts';
import { pricePerPiece, toBuy } from '#lib/quantity.ts';
import { parseOrderForm } from '#lib/server/orders.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { validateFinalize } from '#lib/server/finalize.ts';
import { chargesForDay } from '#lib/server/charges.ts';
import { requireManager } from '#lib/server/guards.ts';
import {
	auditLog,
	billPayment,
	day,
	dayItem,
	item,
	orderLine,
	response,
	user
} from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

const failKey = (status: number, key: MessageKey) => fail(status, { messageKey: key });

/** db.batch needs a statically non-empty tuple; every caller guarantees at least one statement. */
const runBatch = (db: Db, statements: BatchItem<'sqlite'>[]) =>
	db.batch(statements as unknown as Parameters<Db['batch']>[0]);

/** Today's day row, or null when the day hasn't started. */
async function todayFor(db: Db) {
	const [today] = await db.select().from(day).where(eq(day.date, dhakaToday())).limit(1);
	return today ?? null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const me = requireManager(locals);
	const db = locals.db;
	const date = dhakaToday();

	const [today, catalog, allUsers, [lastDay]] = await Promise.all([
		todayFor(db),
		db
			.select({ id: item.id, name: item.name, unitBn: item.unitBn, unitEn: item.unitEn })
			.from(item)
			.where(eq(item.archived, false))
			.orderBy(item.name),
		db
			.select({ id: user.id, name: user.name, image: user.image, active: user.active })
			.from(user)
			.orderBy(user.name),
		db.select({ id: day.id }).from(day).orderBy(desc(day.date)).limit(1)
	]);

	const [lastDayItems, responses, lines] = await Promise.all([
		lastDay && lastDay.id !== today?.id
			? db.select({ itemId: dayItem.itemId }).from(dayItem).where(eq(dayItem.dayId, lastDay.id))
			: Promise.resolve([]),
		today
			? db
					.select({
						userId: response.userId,
						eating: response.eating,
						addedBy: response.addedBy
					})
					.from(response)
					.where(eq(response.dayId, today.id))
			: Promise.resolve([]),
		today
			? db
					.select({
						userId: orderLine.userId,
						itemId: orderLine.itemId,
						quantity: orderLine.quantity12ths,
						finalQuantity: orderLine.finalQuantity12ths
					})
					.from(orderLine)
					.where(eq(orderLine.dayId, today.id))
			: Promise.resolve([])
	]);

	if (!today) {
		return {
			meId: me.id,
			date,
			day: null,
			menu: [],
			items: catalog,
			members: allUsers,
			people: [],
			counts: { yes: 0, no: 0, noAnswer: 0 },
			lastDayItems: lastDayItems.map((r) => r.itemId),
			payments: null,
			charges: null,
			grandTotal: null
		};
	}

	const unitsExpr =
		today.status === 'finalized' ? orderLine.finalQuantity12ths : orderLine.quantity12ths;
	const [menu, unitRows, paymentRows] = await Promise.all([
		db
			.select({
				id: dayItem.itemId,
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
			.select({
				itemId: orderLine.itemId,
				units: sql<number>`coalesce(sum(${unitsExpr}), 0)`.mapWith(Number)
			})
			.from(orderLine)
			.where(eq(orderLine.dayId, today.id))
			.groupBy(orderLine.itemId),
		today.status === 'closed' || today.status === 'finalized'
			? db
					.select({ id: billPayment.id, userId: billPayment.userId, amount: billPayment.amount })
					.from(billPayment)
					.where(eq(billPayment.dayId, today.id))
			: Promise.resolve([])
	]);
	const unitsOf = new Map(unitRows.map((r) => [r.itemId, r.units]));

	// Per-unit cost from the most recent finalized day that offered the item with units > 0.
	const history =
		today.status === 'closed'
			? await db
					.select({
						itemId: dayItem.itemId,
						totalCost: dayItem.totalCost,
						units: sql<number>`(select coalesce(sum(ol.final_quantity_12ths), 0) from order_line ol
						where ol.day_id = ${dayItem.dayId} and ol.item_id = ${dayItem.itemId})`.mapWith(Number)
					})
					.from(dayItem)
					.innerJoin(day, eq(day.id, dayItem.dayId))
					.where(and(eq(day.status, 'finalized'), isNotNull(dayItem.totalCost)))
					.orderBy(desc(day.date))
			: [];
	const suggestionOf = (itemId: string) => {
		const units = unitsOf.get(itemId) ?? 0;
		const past = history.find((h) => h.itemId === itemId && h.units > 0);
		if (!past || !past.totalCost || units === 0) return null;
		const perUnit = pricePerPiece(past.totalCost, past.units);
		return { suggestion: perUnit * toBuy(units), perUnit };
	};

	const respOf = new Map(responses.map((r) => [r.userId, r]));
	const linesOf = new Map<string, typeof lines>();
	for (const line of lines) {
		const list = linesOf.get(line.userId) ?? [];
		list.push(line);
		linesOf.set(line.userId, list);
	}

	const people = allUsers
		.filter((u) => u.active !== false || respOf.has(u.id) || linesOf.has(u.id))
		.map((u) => ({
			id: u.id,
			name: u.name,
			image: u.image,
			active: u.active !== false,
			eating: respOf.get(u.id)?.eating ?? null,
			addedBy: respOf.get(u.id)?.addedBy ?? null,
			lines: linesOf.get(u.id) ?? []
		}));

	const counts = { yes: 0, no: 0, noAnswer: 0 };
	for (const u of allUsers) {
		if (u.active === false) continue;
		const eating = respOf.get(u.id)?.eating;
		if (eating === undefined) counts.noAnswer++;
		else if (eating) counts.yes++;
		else counts.no++;
	}

	const charges =
		today.status === 'finalized'
			? [...(await chargesForDay(db, today.id)).entries()].map(([userId, amount]) => ({
					userId,
					amount
				}))
			: null;

	return {
		meId: me.id,
		date,
		day: {
			id: today.id,
			status: today.status,
			deliveryFee: today.deliveryFee,
			discount: today.discount
		},
		menu: menu.map((m) => ({
			...m,
			purchaseUnits: unitsOf.get(m.id) ?? 0,
			purchaseBuy: toBuy(unitsOf.get(m.id) ?? 0),
			suggestion: suggestionOf(m.id)
		})),
		items: catalog,
		members: allUsers,
		people,
		counts,
		lastDayItems: lastDayItems.map((r) => r.itemId),
		payments: paymentRows.length > 0 || today.status === 'finalized' ? paymentRows : null,
		charges,
		grandTotal: charges ? charges.reduce((a, c) => a + c.amount, 0) : null
	};
};

export const actions: Actions = {
	/** Open today with the ticked items. */
	start: async ({ locals, request }) => {
		const me = requireManager(locals);
		const db = locals.db;
		if (await todayFor(db)) return failKey(409, 'manage.error.exists');

		const form = await request.formData();
		const ids = form.getAll('itemId').map(String);
		if (ids.length === 0) return failKey(400, 'manage.start.error.none');
		const unique = [...new Set(ids)];
		if (unique.length !== ids.length) return failKey(400, 'manage.error.invalid');
		const allowed = await db
			.select({ id: item.id })
			.from(item)
			.where(and(inArray(item.id, unique), eq(item.archived, false)));
		if (allowed.length !== unique.length) return failKey(400, 'manage.error.invalid');

		const dayId = crypto.randomUUID();
		try {
			await db.batch([
				db.insert(day).values({ id: dayId, date: dhakaToday(), status: 'open', createdBy: me.id }),
				db.insert(dayItem).values(unique.map((itemId) => ({ dayId, itemId, available: true })))
			]);
		} catch (e) {
			// Another manager started the day first; the unique index on day.date caught it.
			if (e instanceof Error && /UNIQUE|day_date_uq/i.test(e.message))
				return failKey(409, 'manage.error.exists');
			throw e;
		}
		return { saved: true };
	},

	/** Add items to the menu and toggle availability; rows are never deleted. */
	setItems: async ({ locals, request }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || (today.status !== 'open' && today.status !== 'closed'))
			return failKey(409, 'manage.error.status');

		const form = await request.formData();
		const checked = new Set(form.getAll('itemId').map(String));
		const catalog = await db.select({ id: item.id }).from(item).where(eq(item.archived, false));
		const allowedIds = new Set(catalog.map((i) => i.id));
		for (const id of checked) if (!allowedIds.has(id)) return failKey(400, 'manage.error.invalid');

		const [current, ordered] = await Promise.all([
			db
				.select({ itemId: dayItem.itemId, available: dayItem.available })
				.from(dayItem)
				.where(eq(dayItem.dayId, today.id)),
			db
				.select({
					itemId: orderLine.itemId,
					qty: sql<number>`sum(${orderLine.quantity12ths})`.mapWith(Number)
				})
				.from(orderLine)
				.where(eq(orderLine.dayId, today.id))
				.groupBy(orderLine.itemId)
		]);
		const orderedQty = new Map(ordered.map((o) => [o.itemId, o.qty]));

		const statements: BatchItem<'sqlite'>[] = [];
		const changes: { added: string[]; unavailable: string[]; available: string[] } = {
			added: [],
			unavailable: [],
			available: []
		};
		let warn = 0;
		const toAdd = [...checked].filter((id) => !current.some((c) => c.itemId === id));
		changes.added = toAdd;
		if (toAdd.length > 0)
			statements.push(
				db
					.insert(dayItem)
					.values(toAdd.map((itemId) => ({ dayId: today.id, itemId, available: true })))
			);
		for (const c of current) {
			const available = checked.has(c.itemId);
			if (available === c.available) continue;
			statements.push(
				db
					.update(dayItem)
					.set({ available })
					.where(and(eq(dayItem.dayId, today.id), eq(dayItem.itemId, c.itemId)))
			);
			(available ? changes.available : changes.unavailable).push(c.itemId);
			if (!available && (orderedQty.get(c.itemId) ?? 0) > 0) warn++;
		}
		if (statements.length > 0) {
			statements.push(
				db.insert(auditLog).values({
					actorId: me.id,
					action: 'day.menu',
					entity: 'day',
					entityId: today.id,
					data: changes
				})
			);
			await runBatch(db, statements);
		}
		return { saved: true, warn };
	},

	/** Close ordering; members without an answer count as not eating. */
	close: async ({ locals }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || today.status !== 'open') return failKey(409, 'manage.error.status');

		const [members, responses] = await Promise.all([
			db.select({ id: user.id, active: user.active }).from(user),
			db
				.select({ userId: response.userId, eating: response.eating })
				.from(response)
				.where(eq(response.dayId, today.id))
		]);
		const respOf = new Map(responses.map((r) => [r.userId, r.eating]));
		const counts = { yes: 0, no: 0, noAnswer: 0 };
		for (const m of members) {
			if (m.active === false) continue;
			const eating = respOf.get(m.id);
			if (eating === undefined) counts.noAnswer++;
			else if (eating) counts.yes++;
			else counts.no++;
		}

		await db.batch([
			db.update(day).set({ status: 'closed' }).where(eq(day.id, today.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'day.close',
				entity: 'day',
				entityId: today.id,
				data: counts
			})
		]);
		return { saved: true };
	},

	/** Reopen ordering after closing. */
	reopenOrders: async ({ locals }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || today.status !== 'closed') return failKey(409, 'manage.error.status');

		await db.batch([
			db.update(day).set({ status: 'open' }).where(eq(day.id, today.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'day.reopen_orders',
				entity: 'day',
				entityId: today.id,
				data: null
			})
		]);
		return { saved: true };
	},

	/** Add or edit one member's order on their behalf (late request). */
	saveMemberOrder: async ({ locals, request }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || (today.status !== 'open' && today.status !== 'closed'))
			return failKey(409, 'manage.error.status');

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const eating = form.get('eating') !== 'false';
		if (!userId) return failKey(400, 'manage.error.invalid');
		const [member] = await db
			.select({ id: user.id, active: user.active })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!member || member.active === false) return failKey(404, 'manage.memberOrder.error.user');

		const offered = await db
			.select({ itemId: dayItem.itemId })
			.from(dayItem)
			.where(and(eq(dayItem.dayId, today.id), eq(dayItem.available, true)));
		const allowed = new Set(offered.map((o) => o.itemId));

		const wanted = parseOrderForm(form, allowed);
		if (!wanted) return failKey(400, 'order.error.invalid');
		if (eating && wanted.length === 0) return failKey(400, 'manage.memberOrder.error.empty');

		const statements: BatchItem<'sqlite'>[] = [
			db
				.insert(response)
				.values({ dayId: today.id, userId, eating, addedBy: me.id })
				.onConflictDoUpdate({
					target: [response.dayId, response.userId],
					set: { eating, updatedAt: new Date(), addedBy: me.id }
				}),
			db.delete(orderLine).where(and(eq(orderLine.dayId, today.id), eq(orderLine.userId, userId))),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'order.manager_edit',
				entity: 'day',
				entityId: today.id,
				data: { userId, lines: wanted }
			})
		];
		if (eating)
			statements.push(
				db.insert(orderLine).values(
					wanted.map((w) => ({
						dayId: today.id,
						userId,
						itemId: w.itemId,
						quantity12ths: w.quantity
					}))
				)
			);
		await runBatch(db, statements);
		return { saved: true };
	},

	/** Enter real costs, final quantities, the delivery fee and who paid; posts the day. */
	finalize: async ({ locals, request }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || today.status !== 'closed') return failKey(409, 'manage.error.status');

		const form = await request.formData();
		const prices: Record<string, string> = {};
		const final: Record<string, number> = {};
		for (const [key, raw] of form) {
			if (key.startsWith('price:')) prices[key.slice(6)] = String(raw);
			else if (key.startsWith('final:')) final[key.slice(6)] = Number(raw);
		}
		const payerValues = form.getAll('payer').map(String);
		const paidValues = form.getAll('paid').map(String);
		const payments = payerValues.map((userId, n) => ({
			userId,
			amount: paidValues[n] ?? ''
		}));

		const [menuItems, lines, allUsers, existingPayers] = await Promise.all([
			db
				.select({ itemId: dayItem.itemId, available: dayItem.available })
				.from(dayItem)
				.where(eq(dayItem.dayId, today.id)),
			db
				.select({
					userId: orderLine.userId,
					itemId: orderLine.itemId,
					quantity: orderLine.quantity12ths
				})
				.from(orderLine)
				.where(eq(orderLine.dayId, today.id)),
			db.select({ id: user.id, active: user.active }).from(user),
			db
				.select({ userId: billPayment.userId })
				.from(billPayment)
				.where(eq(billPayment.dayId, today.id))
		]);

		// Active members, plus anyone already a payer on this day (e.g. deactivated since).
		const payerIds = new Set(allUsers.filter((u) => u.active !== false).map((u) => u.id));
		for (const p of existingPayers) payerIds.add(p.userId);

		const result = validateFinalize(
			{
				prices,
				final,
				deliveryFee: String(form.get('deliveryFee') ?? ''),
				discount: String(form.get('discount') ?? ''),
				payments
			},
			{
				items: menuItems.map((m) => ({ id: m.itemId, available: m.available })),
				lines,
				payerIds
			}
		);
		if (!result.ok) {
			const errorParams =
				result.mismatch === null
					? undefined
					: { payments: { amount: formatTaka(Math.abs(result.mismatch), locals.locale) } };
			return fail(400, { errors: result.errors, errorParams });
		}
		const v = result.value;

		await runBatch(db, [
			...v.costs.map((c) =>
				db
					.update(dayItem)
					.set({ totalCost: c.totalCost })
					.where(and(eq(dayItem.dayId, today.id), eq(dayItem.itemId, c.itemId)))
			),
			...v.final.map((f) =>
				db
					.update(orderLine)
					.set({ finalQuantity12ths: f.quantity })
					.where(
						and(
							eq(orderLine.dayId, today.id),
							eq(orderLine.userId, f.userId),
							eq(orderLine.itemId, f.itemId)
						)
					)
			),
			db
				.update(day)
				.set({
					deliveryFee: v.deliveryFee,
					discount: v.discount,
					status: 'finalized',
					finalizedAt: new Date(),
					finalizedBy: me.id
				})
				.where(eq(day.id, today.id)),
			db.delete(billPayment).where(eq(billPayment.dayId, today.id)),
			// Everyone skipped: no payment rows when the grand total is 0.
			...(v.payments.length > 0
				? [db.insert(billPayment).values(v.payments.map((p) => ({ dayId: today.id, ...p })))]
				: []),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'day.finalize',
				entity: 'day',
				entityId: today.id,
				data: {
					itemsTotal: v.itemsTotal,
					deliveryFee: v.deliveryFee,
					discount: v.discount,
					grandTotal: v.grandTotal,
					payments: v.payments
				}
			})
		]);
		return { saved: true };
	},

	/** Reopen a finalized day for fixing; costs, finals and payments are kept pre-filled. */
	reopenDay: async ({ locals }) => {
		const me = requireManager(locals);
		const db = locals.db;
		const today = await todayFor(db);
		if (!today || today.status !== 'finalized') return failKey(409, 'manage.error.status');

		const [costs, paid] = await Promise.all([
			db
				.select({ total: sql<number>`coalesce(sum(${dayItem.totalCost}), 0)`.mapWith(Number) })
				.from(dayItem)
				.where(eq(dayItem.dayId, today.id)),
			db
				.select({ total: sql<number>`coalesce(sum(${billPayment.amount}), 0)`.mapWith(Number) })
				.from(billPayment)
				.where(eq(billPayment.dayId, today.id))
		]);
		const itemsTotal = (costs[0]?.total ?? 0) as Poisha;
		const paidTotal = (paid[0]?.total ?? 0) as Poisha;

		await db.batch([
			db
				.update(day)
				.set({ status: 'closed', finalizedAt: null, finalizedBy: null })
				.where(eq(day.id, today.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'day.reopen',
				entity: 'day',
				entityId: today.id,
				data: {
					itemsTotal,
					deliveryFee: today.deliveryFee,
					discount: today.discount,
					grandTotal: itemsTotal + today.deliveryFee - today.discount,
					paidTotal
				}
			})
		]);
		return { saved: true };
	}
};
