import { computeCharges, type ChargeItem, type ChargeLine } from '#lib/charges.ts';
import type { MessageKey } from '#lib/i18n/index.ts';
import { parseTaka, type Poisha } from '#lib/money.ts';

/**
 * The pure ledger math, shared by the server (`computeLedger`) and the browser
 * (settle-up hints). No database or server imports.
 */

export type LedgerDay = { id: string; date: string; deliveryFee: Poisha };
export type LedgerDayItem = { dayId: string; itemId: string; totalCost: Poisha | null };
export type LedgerLine = {
	dayId: string;
	userId: string;
	itemId: string;
	finalQuantity: number | null;
};
export type LedgerPayment = { dayId: string; userId: string; amount: Poisha };
export type LedgerSettlement = {
	id: string;
	fromUserId: string;
	toUserId: string;
	amount: Poisha;
	voidedAt: Date | null;
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
export function balancesFrom({ days, items, lines, payments, settlements }: LedgerInput) {
	const balances = new Map<string, Poisha>();
	const bump = (userId: string, delta: number) =>
		balances.set(userId, (balances.get(userId) ?? 0) + delta);

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

	for (const d of days) {
		for (const [userId, charge] of computeCharges(
			itemsByDay.get(d.id) ?? [],
			linesByDay.get(d.id) ?? [],
			d.deliveryFee
		))
			bump(userId, -charge);
	}
	for (const p of payments) if (counted.has(p.dayId)) bump(p.userId, p.amount);
	for (const s of settlements) {
		if (s.voidedAt !== null) continue;
		bump(s.fromUserId, s.amount);
		bump(s.toUserId, -s.amount);
	}
	return balances;
}

export type Transfer = { from: string; to: string; amount: Poisha };

/**
 * Settle-up suggestions: greedy matching of the largest debtor with the largest
 * creditor until every balance is zero. Ties break by user id, so the result is
 * stable. Not the mathematical minimum (that's NP-hard), but never more than
 * n − 1 transfers for n non-zero balances.
 */
export function suggestSettlements(balances: Map<string, Poisha>): Transfer[] {
	type Side = { id: string; left: Poisha };
	const debtors: Side[] = [];
	const creditors: Side[] = [];
	for (const [id, amount] of balances) {
		if (amount < 0) debtors.push({ id, left: -amount });
		else if (amount > 0) creditors.push({ id, left: amount });
	}

	// Largest side first; ties break by the smaller user id.
	const pick = (list: Side[]) => {
		let best = list[0];
		for (const side of list)
			if (side.left > best.left || (side.left === best.left && side.id < best.id)) best = side;
		return best;
	};

	const transfers: Transfer[] = [];
	while (debtors.length > 0 && creditors.length > 0) {
		const debtor = pick(debtors);
		const creditor = pick(creditors);
		const amount = Math.min(debtor.left, creditor.left);
		transfers.push({ from: debtor.id, to: creditor.id, amount });
		debtor.left -= amount;
		creditor.left -= amount;
		if (debtor.left === 0) debtors.splice(debtors.indexOf(debtor), 1);
		if (creditor.left === 0) creditors.splice(creditors.indexOf(creditor), 1);
	}
	return transfers;
}

/** Who may record "A paid B ৳X": a party of the settlement, or any manager. */
export const canRecordSettlement = (meId: string, isManager: boolean, from: string, to: string) =>
	isManager || from === meId || to === meId;

/** Who may void a settlement: whoever created it, or any manager. */
export const canVoidSettlement = (meId: string, isManager: boolean, createdBy: string) =>
	isManager || createdBy === meId;

export const MAX_NOTE = 100;

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
