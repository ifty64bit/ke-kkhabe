import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { dhakaToday } from '#lib/date.ts';
import {
	canDecideSettlement,
	canRecordSettlement,
	canVoidSettlement,
	initialSettlementStatus,
	suggestSettlements,
	validateRejectReason,
	validateSettlementInput
} from '#lib/ledger.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { auditLog, settlement, user } from '#lib/server/db/schema.ts';
import { computeLedger } from '#lib/server/ledger.ts';
import type { Actions, PageServerLoad } from './$types';

const DAY_MS = 86_400_000;

export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user!;
	const db = locals.db;
	const today = dhakaToday();

	const [{ balances, hasFinalized }, userRows] = await Promise.all([
		computeLedger(db),
		db
			.select({
				id: user.id,
				name: user.name,
				image: user.image,
				role: user.role,
				active: user.active
			})
			.from(user)
			.orderBy(user.name)
	]);
	const people = userRows.map((r) => ({
		...r,
		role: r.role ?? 'member',
		active: r.active !== false
	}));
	const personOf = new Map(people.map((p) => [p.id, p]));

	// Every non-zero balance (including deactivated accounts), plus settled active members.
	const rows = people
		.map((p) => ({ ...p, balance: balances.get(p.id) ?? 0 }))
		.filter((p) => p.balance !== 0 || p.active !== false)
		.toSorted((a, b) => {
			const group = (v: number) => (v > 0 ? 0 : v < 0 ? 2 : 1);
			return (
				group(a.balance) - group(b.balance) ||
				(a.balance < 0 ? a.balance - b.balance : b.balance - a.balance) ||
				(a.name < b.name ? -1 : 1)
			);
		});

	const suggestions = suggestSettlements(balances).map((t) => ({
		...t,
		fromName: personOf.get(t.from)?.name ?? t.from,
		toName: personOf.get(t.to)?.name ?? t.to
	}));

	const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * DAY_MS)
		.toISOString()
		.slice(0, 10);
	const fromUser = alias(user, 'from_user');
	const toUser = alias(user, 'to_user');
	const recorder = alias(user, 'recorder');
	const decider = alias(user, 'decider');
	const [awaitingMe, [pendingOut], recent] = await Promise.all([
		db
			.select({
				id: settlement.id,
				fromId: settlement.fromUserId,
				fromName: fromUser.name,
				amount: settlement.amount,
				date: settlement.date,
				note: settlement.note
			})
			.from(settlement)
			.innerJoin(fromUser, eq(fromUser.id, settlement.fromUserId))
			.where(
				and(
					eq(settlement.toUserId, me.id),
					eq(settlement.status, 'pending'),
					isNull(settlement.voidedAt)
				)
			)
			.orderBy(asc(settlement.createdAt)),
		db
			.select({ total: sql<number>`coalesce(sum(${settlement.amount}), 0)`.mapWith(Number) })
			.from(settlement)
			.where(
				and(
					eq(settlement.fromUserId, me.id),
					eq(settlement.status, 'pending'),
					isNull(settlement.voidedAt)
				)
			),
		db
			.select({
				id: settlement.id,
				fromId: settlement.fromUserId,
				fromName: fromUser.name,
				toId: settlement.toUserId,
				toName: toUser.name,
				amount: settlement.amount,
				date: settlement.date,
				note: settlement.note,
				status: settlement.status,
				rejectReason: settlement.rejectReason,
				createdBy: settlement.createdBy,
				createdByName: recorder.name,
				decidedByName: decider.name,
				createdAt: settlement.createdAt
			})
			.from(settlement)
			.innerJoin(fromUser, eq(fromUser.id, settlement.fromUserId))
			.innerJoin(toUser, eq(toUser.id, settlement.toUserId))
			.leftJoin(recorder, eq(recorder.id, settlement.createdBy))
			.leftJoin(decider, eq(decider.id, settlement.decidedBy))
			.where(and(isNull(settlement.voidedAt), gte(settlement.date, cutoff)))
			.orderBy(desc(settlement.date), desc(settlement.createdAt))
	]);

	return {
		meId: me.id,
		isManager: me.role === 'manager',
		today,
		hasFinalized,
		myBalance: balances.get(me.id) ?? 0,
		myPending: pendingOut?.total ?? 0,
		people,
		balances: rows,
		suggestions,
		awaitingMe,
		recent
	};
};

const failKey = (status: number, key: MessageKey) => fail(status, { messageKey: key });

export const actions: Actions = {
	/** Record "A paid B ৳X". The row itself is the record; no audit entry is written. */
	record: async ({ locals, request }) => {
		const me = locals.user!;
		const db = locals.db;
		const form = await request.formData();
		const raw = {
			from: String(form.get('from') ?? ''),
			to: String(form.get('to') ?? ''),
			amount: String(form.get('amount') ?? ''),
			note: String(form.get('note') ?? ''),
			date: String(form.get('date') ?? '')
		};
		if (!canRecordSettlement(me.id, me.role === 'manager', raw.from, raw.to))
			return failKey(403, 'ledger.error.recordPermission');

		const result = validateSettlementInput(raw, { today: dhakaToday() });
		if (!result.ok) return fail(400, { errors: result.errors });
		const v = result.value;

		const found = await db
			.select({ id: user.id })
			.from(user)
			.where(inArray(user.id, [v.fromUserId, v.toUserId]));
		const have = new Set(found.map((f) => f.id));
		if (!have.has(v.fromUserId)) return fail(400, { errors: { from: 'ledger.error.user' } });
		if (!have.has(v.toUserId)) return fail(400, { errors: { to: 'ledger.error.user' } });

		const status = initialSettlementStatus(me.id, v.toUserId);
		await db.insert(settlement).values({
			fromUserId: v.fromUserId,
			toUserId: v.toUserId,
			amount: v.amount,
			date: v.date,
			note: v.note,
			createdBy: me.id,
			status
		});
		return { saved: true, pending: status === 'pending' };
	},

	/** Soft-delete a settlement; the balances change, the row stays. */
	void: async ({ locals, request }) => {
		const me = locals.user!;
		const db = locals.db;
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const [row] = await db.select().from(settlement).where(eq(settlement.id, id)).limit(1);
		if (!row) return failKey(404, 'ledger.error.notFound');
		if (row.status === 'rejected') return failKey(409, 'ledger.error.notPending');
		if (!canVoidSettlement(me.id, me.role === 'manager', row.createdBy, row.status))
			return failKey(403, 'ledger.error.voidPermission');
		if (row.voidedAt) return failKey(409, 'ledger.error.voided');

		await db.batch([
			db
				.update(settlement)
				.set({ voidedAt: new Date(), voidedBy: me.id })
				.where(eq(settlement.id, row.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'settlement.void',
				entity: 'settlement',
				entityId: row.id,
				data: { from: row.fromUserId, to: row.toUserId, amount: row.amount, date: row.date }
			})
		]);
		return { saved: true };
	},

	/** Approve a pending settlement: only the receiver may, and only once. */
	approve: async ({ locals, request }) => {
		const me = locals.user!;
		const db = locals.db;
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const [row] = await db.select().from(settlement).where(eq(settlement.id, id)).limit(1);
		if (!row) return failKey(404, 'ledger.error.notFound');
		if (me.id !== row.toUserId) return failKey(403, 'ledger.error.decidePermission');
		if (!canDecideSettlement(me.id, row)) return failKey(409, 'ledger.error.notPending');

		await db.batch([
			db
				.update(settlement)
				.set({ status: 'approved', decidedBy: me.id, decidedAt: new Date() })
				.where(eq(settlement.id, row.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'settlement.approve',
				entity: 'settlement',
				entityId: row.id,
				data: { from: row.fromUserId, to: row.toUserId, amount: row.amount, date: row.date }
			})
		]);
		return { saved: true };
	},

	/** Reject a pending settlement; final, with an optional trimmed reason. */
	reject: async ({ locals, request }) => {
		const me = locals.user!;
		const db = locals.db;
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const [row] = await db.select().from(settlement).where(eq(settlement.id, id)).limit(1);
		if (!row) return failKey(404, 'ledger.error.notFound');
		if (me.id !== row.toUserId) return failKey(403, 'ledger.error.decidePermission');
		if (!canDecideSettlement(me.id, row)) return failKey(409, 'ledger.error.notPending');

		const reason = validateRejectReason(String(form.get('reason') ?? ''));
		if (!reason.ok) return fail(400, { errors: { reason: reason.error } });

		const data: Record<string, unknown> = {
			from: row.fromUserId,
			to: row.toUserId,
			amount: row.amount,
			date: row.date
		};
		if (reason.value !== null) data.reason = reason.value;

		await db.batch([
			db
				.update(settlement)
				.set({
					status: 'rejected',
					decidedBy: me.id,
					decidedAt: new Date(),
					rejectReason: reason.value
				})
				.where(eq(settlement.id, row.id)),
			db.insert(auditLog).values({
				actorId: me.id,
				action: 'settlement.reject',
				entity: 'settlement',
				entityId: row.id,
				data
			})
		]);
		return { saved: true };
	}
};
