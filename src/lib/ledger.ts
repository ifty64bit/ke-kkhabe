import { computeCharges, type ChargeItem, type ChargeLine } from '#lib/charges.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { parseTaka, type Poisha } from '#lib/money.ts';

/**
 * The pure ledger math, shared by the server (`computeLedger`) and the browser
 * (settle-up hints). No database or server imports.
 */

export type LedgerDay = { id: string; date: string; deliveryFee: Poisha; discount?: Poisha };
export type LedgerDayItem = { dayId: string; itemId: string; totalCost: Poisha | null };
export type LedgerLine = {
	dayId: string;
	userId: string;
	itemId: string;
	finalQuantity: number | null;
};
export type LedgerPayment = { dayId: string; userId: string; amount: Poisha };

export const SETTLEMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export type LedgerSettlement = {
	id: string;
	fromUserId: string;
	toUserId: string;
	amount: Poisha;
	voidedAt: Date | null;
	status: SettlementStatus;
};

export type LedgerInput = {
	/** Only these days count; rows belonging to other days (e.g. reopened) are ignored. */
	days: LedgerDay[];
	items: LedgerDayItem[];
	lines: LedgerLine[];
	payments: LedgerPayment[];
	settlements: LedgerSettlement[];
};

/**
 * Net balance per user, in poisha: positive means others owe them, negative means
 * they owe. Charges and bill payments of the finalized days, minus settlements
 * received, plus settlements sent. The sum over all users is exactly 0.
 */
export function balancesFrom(input: LedgerInput) {
	const balances = new Map<string, Poisha>();
	const bump = (userId: string, delta: number) =>
		balances.set(userId, (balances.get(userId) ?? 0) + delta);

	for (const nets of dayNets(input).values()) for (const [userId, net] of nets) bump(userId, net);
	for (const s of input.settlements) {
		// Only an approved, non-voided settlement moves a balance.
		if (s.status !== 'approved' || s.voidedAt !== null) continue;
		bump(s.fromUserId, s.amount);
		bump(s.toUserId, -s.amount);
	}
	return balances;
}

/**
 * Each finalized day's effect on each user, in poisha: bill payments minus charges.
 * Keyed by day id, in the order of `days`.
 */
function dayNets({ days, items, lines, payments }: LedgerInput) {
	const counted = new Set(days.map((d) => d.id));
	const itemsByDay = new Map<string, ChargeItem[]>();
	const linesByDay = new Map<string, ChargeLine[]>();
	for (const item of items) {
		if (!counted.has(item.dayId)) continue;
		const list = itemsByDay.get(item.dayId) ?? [];
		list.push(item);
		itemsByDay.set(item.dayId, list);
	}
	for (const line of lines) {
		if (!counted.has(line.dayId)) continue;
		const list = linesByDay.get(line.dayId) ?? [];
		list.push(line);
		linesByDay.set(line.dayId, list);
	}

	const nets = new Map<string, Map<string, Poisha>>();
	for (const d of days) {
		const m = new Map<string, Poisha>();
		for (const [userId, charge] of computeCharges(
			itemsByDay.get(d.id) ?? [],
			linesByDay.get(d.id) ?? [],
			d.deliveryFee,
			d.discount ?? 0
		))
			m.set(userId, (m.get(userId) ?? 0) - charge);
		nets.set(d.id, m);
	}
	for (const p of payments) {
		const m = nets.get(p.dayId);
		if (m) m.set(p.userId, (m.get(p.userId) ?? 0) + p.amount);
	}
	return nets;
}

export type Transfer = { from: string; to: string; amount: Poisha };

/** A day behind a settle-up amount. */
export type TransferDay = {
	dayId: string;
	date: string;
	/** The part of this day the transfer pays for. */
	amount: Poisha;
	/** What the payer owed the receiver for this day in all. */
	dayNet: Poisha;
};

export type Suggestion = Transfer & { days: TransferDay[] };

/**
 * One day's debts: everyone who was charged more than they paid owes the people who
 * paid more than they were charged. Debtors and creditors are lined up in user-id order
 * and matched along the way (so with one bill payer, every eater owes that payer their
 * whole share). Integer and exact: each person's debts add up to their day net.
 */
function splitDay(nets: Map<string, Poisha>): Transfer[] {
	const byId = (a: [string, Poisha], b: [string, Poisha]) => (a[0] < b[0] ? -1 : 1);
	const debtors = [...nets]
		.filter(([, n]) => n < 0)
		.sort(byId)
		.map(([id, n]) => ({ id, left: -n }));
	const creditors = [...nets]
		.filter(([, n]) => n > 0)
		.sort(byId)
		.map(([id, n]) => ({ id, left: n }));
	const out: Transfer[] = [];
	let c = 0;
	for (const d of debtors) {
		while (d.left > 0 && c < creditors.length) {
			const amount = Math.min(d.left, creditors[c].left);
			out.push({ from: d.id, to: creditors[c].id, amount });
			d.left -= amount;
			creditors[c].left -= amount;
			if (creditors[c].left === 0) c++;
		}
	}
	return out;
}

/**
 * Settle-up suggestions, person to person: on each finalized day an eater owes whoever
 * paid that bill; settlements between the two pay it down; debts both ways between the
 * same two people cancel. What is left is one transfer per pair, so nobody is told to
 * pay someone they never ate with or paid for. Each person's transfers add up to their
 * balance.
 *
 * Each transfer lists the days it pays for: the payer's debts to that receiver, newest
 * first, older ones taken as paid first (the oldest open one possibly in part). A
 * transfer that comes from a settlement rather than a day (e.g. paying back an
 * overpayment) lists fewer days, or none.
 *
 * Ordered by amount, largest first; ties by payer then receiver id.
 */
export function pairwiseSettlements(input: LedgerInput): Suggestion[] {
	const dateOf = new Map(input.days.map((d) => [d.id, d.date]));
	const key = (from: string, to: string) => `${from}\u0000${to}`;
	/** Signed total each person owes another, by ordered pair. */
	const owed = new Map<string, Poisha>();
	/** The days behind each ordered pair's debt, in `days` order. */
	const flows = new Map<string, { dayId: string; amount: Poisha }[]>();
	const pairs = new Map<string, [string, string]>();
	const add = (from: string, to: string, amount: Poisha) => {
		owed.set(key(from, to), (owed.get(key(from, to)) ?? 0) + amount);
		const [a, b] = from < to ? [from, to] : [to, from];
		pairs.set(key(a, b), [a, b]);
	};

	for (const [dayId, nets] of dayNets(input)) {
		for (const t of splitDay(nets)) {
			add(t.from, t.to, t.amount);
			const list = flows.get(key(t.from, t.to)) ?? [];
			list.push({ dayId, amount: t.amount });
			flows.set(key(t.from, t.to), list);
		}
	}
	for (const s of input.settlements) {
		if (s.status !== 'approved' || s.voidedAt !== null) continue;
		add(s.fromUserId, s.toUserId, -s.amount);
	}

	const out: Suggestion[] = [];
	for (const [a, b] of pairs.values()) {
		const net = (owed.get(key(a, b)) ?? 0) - (owed.get(key(b, a)) ?? 0);
		if (net === 0) continue;
		const [from, to] = net > 0 ? [a, b] : [b, a];
		const amount = Math.abs(net);
		const days: TransferDay[] = [];
		let left = amount;
		const newestFirst = (flows.get(key(from, to)) ?? []).toSorted((x, y) => {
			const dx = dateOf.get(x.dayId)!;
			const dy = dateOf.get(y.dayId)!;
			return dx < dy ? 1 : dx > dy ? -1 : x.dayId < y.dayId ? 1 : -1;
		});
		for (const f of newestFirst) {
			if (left === 0) break;
			const part = Math.min(f.amount, left);
			days.push({ dayId: f.dayId, date: dateOf.get(f.dayId)!, amount: part, dayNet: f.amount });
			left -= part;
		}
		out.push({ from, to, amount, days });
	}
	return out.sort(
		(x, y) =>
			y.amount - x.amount ||
			(x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : x.to > y.to ? 1 : 0)
	);
}

/** Who may record "A paid B ৳X": a party of the settlement, or any manager. */
export const canRecordSettlement = (meId: string, isManager: boolean, from: string, to: string) =>
	isManager || from === meId || to === meId;

/**
 * A settlement starts `approved` when the receiver logs it themselves (logging it is the
 * confirmation); anything the payer or a manager logs waits for the receiver.
 */
export const initialSettlementStatus = (meId: string, toUserId: string): SettlementStatus =>
	meId === toUserId ? 'approved' : 'pending';

/** Only the receiver may approve or reject, and only while the row is pending and not voided. */
export const canDecideSettlement = (
	meId: string,
	row: { toUserId: string; status: SettlementStatus; voidedAt: Date | null }
) => meId === row.toUserId && row.status === 'pending' && row.voidedAt === null;

/** Who may void: whoever created it, or any manager — but a rejected row is final. */
export const canVoidSettlement = (
	meId: string,
	isManager: boolean,
	createdBy: string,
	status: SettlementStatus
) => status !== 'rejected' && (isManager || createdBy === meId);

export const MAX_NOTE = 100;

/** Trim the reject reason; '' becomes null, anything over `MAX_NOTE` is refused, not truncated. */
export function validateRejectReason(
	raw: string
): { ok: true; value: string | null } | { ok: false; error: MessageKey } {
	const reason = raw.trim();
	if (reason === '') return { ok: true, value: null };
	if (reason.length > MAX_NOTE) return { ok: false, error: 'ledger.error.reasonLong' };
	return { ok: true, value: reason };
}

export type SettlementForm = {
	from: string;
	to: string;
	/** Unparsed taka string; '' is invalid here (unlike day costs, a settlement needs an amount). */
	amount: string;
	note: string;
	/** Optional YYYY-MM-DD; '' means today. */
	date: string;
};

export type SettlementField = 'from' | 'to' | 'amount' | 'note' | 'date';
export type SettlementErrors = Partial<Record<SettlementField, MessageKey>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Pure validation for the record form, unit-testable without a database. */
export function validateSettlementInput(
	form: SettlementForm,
	ctx: { today: string }
):
	| {
			ok: true;
			value: {
				fromUserId: string;
				toUserId: string;
				amount: Poisha;
				note: string | null;
				date: string;
			};
	  }
	| {
			ok: false;
			errors: SettlementErrors;
	  } {
	const errors: SettlementErrors = {};
	const from = form.from.trim();
	const to = form.to.trim();
	if (!from) errors.from = 'ledger.error.pickMember';
	if (!to) errors.to = 'ledger.error.pickMember';
	else if (from && to === from) errors.to = 'ledger.error.self';

	const amount = parseTaka(form.amount);
	if (amount === null || amount <= 0) errors.amount = 'ledger.error.amount';

	const note = form.note.trim();
	if (note.length > MAX_NOTE) errors.note = 'ledger.error.note';

	let date = ctx.today;
	if (form.date !== '') {
		// Reject malformed and impossible dates (2026-02-31 rolls over to March).
		const parsed = DATE_RE.test(form.date) ? new Date(`${form.date}T00:00:00Z`) : null;
		const valid = parsed !== null && parsed.toISOString().slice(0, 10) === form.date;
		if (!valid || form.date > ctx.today) errors.date = 'ledger.error.date';
		else date = form.date;
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			fromUserId: from,
			toUserId: to,
			amount: amount!,
			note: note === '' ? null : note,
			date
		}
	};
}

/** The fields `groupHistory` needs from a settlement row. */
export type HistoryRow = {
	date: string;
	fromId: string;
	toId: string;
	amount: Poisha;
	status: SettlementStatus;
	voidedAt: Date | null;
};

export type HistoryMonth<T extends HistoryRow> = {
	/** YYYY-MM */
	month: string;
	entries: (T & { direction: 'in' | 'out'; counts: boolean })[];
	/** Approved, unvoided totals for the month, so they match the balance. */
	paid: Poisha;
	received: Poisha;
	/** Pending, unvoided totals: what is still waiting for approval. */
	pendingPaid: Poisha;
	pendingReceived: Poisha;
};

/**
 * A member's settlement history as khata pages: only rows where `meId` paid or received,
 * grouped by month (newest first), each entry marked in/out and whether it counts.
 * Rows within a month keep their given order after a stable sort by date, newest first.
 */
export function groupHistory<T extends HistoryRow>(rows: T[], meId: string): HistoryMonth<T>[] {
	const months = new Map<string, HistoryMonth<T>>();
	const mine = rows
		.filter((r) => r.fromId === meId || r.toId === meId)
		.toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	for (const r of mine) {
		const key = r.date.slice(0, 7);
		let m = months.get(key);
		if (!m) {
			m = { month: key, entries: [], paid: 0, received: 0, pendingPaid: 0, pendingReceived: 0 };
			months.set(key, m);
		}
		const direction = r.fromId === meId ? 'out' : 'in';
		const counts = r.status === 'approved' && !r.voidedAt;
		m.entries.push({ ...r, direction, counts });
		if (counts) {
			if (direction === 'out') m.paid += r.amount;
			else m.received += r.amount;
		} else if (r.status === 'pending' && !r.voidedAt) {
			if (direction === 'out') m.pendingPaid += r.amount;
			else m.pendingReceived += r.amount;
		}
	}
	return [...months.values()];
}

/**
 * My settle-up suggestions, less what I already sent and is waiting for approval.
 * `pendingTo` maps a receiver's id to my pending total to them. `remaining` is what is
 * left to pay (never below 0); `pending` is the part of the suggestion already sent.
 */
export function applyPending<T extends { to: string; amount: Poisha }>(
	transfers: T[],
	pendingTo: Record<string, Poisha>
): (T & { remaining: Poisha; pending: Poisha })[] {
	return transfers.map((t) => {
		const pending = Math.min(t.amount, pendingTo[t.to] ?? 0);
		return { ...t, remaining: t.amount - pending, pending };
	});
}
