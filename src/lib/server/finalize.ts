import type { MessageKey } from '#lib/i18n/index.ts';
import { computeCharges } from '#lib/charges.ts';
import { lineTotal, parseTaka, sum, type Poisha } from '#lib/money.ts';

/**
 * Pure validation for the finalize form, unit-testable without a database.
 * The action parses the request into a `FinalizeForm`, validates it here, and only
 * writes anything when the result is `ok`.
 */

export const MAX_QTY = 20;

export type FinalizeItem = { id: string; available: boolean };

export type FinalizeLine = { userId: string; itemId: string; quantity: number };

/**
 * Raw form input. For each item someone ate, the manager enters a per-piece price
 * (`prices`), or, when it came from more than one shop at different prices, the item's
 * total (`totals`; presence of the key selects total mode). Items nobody ate need neither.
 * Fee and discount are taka strings where '' means 0.
 */
export type FinalizeForm = {
	prices: Record<string, string>;
	totals: Record<string, string>;
	/** Keyed by `userId:itemId`, for every existing order line. */
	final: Record<string, number>;
	deliveryFee: string;
	discount: string;
	payments: { userId: string; amount: string }[];
};

export type FinalizeContext = {
	/** Today's menu items. */
	items: FinalizeItem[];
	/** Existing order lines for today. */
	lines: FinalizeLine[];
	/** Users allowed as payers: active members plus anyone already a payer on this day. */
	payerIds: Set<string>;
};

export type FinalizeErrors = Record<string, MessageKey>;

export type FinalizeValue = {
	costs: { itemId: string; totalCost: Poisha }[];
	final: { userId: string; itemId: string; quantity: number }[];
	deliveryFee: Poisha;
	discount: Poisha;
	payments: { userId: string; amount: Poisha }[];
	itemsTotal: Poisha;
	deliveryFeeTotal: Poisha;
	grandTotal: Poisha;
	paidTotal: Poisha;
};

export type FinalizeResult =
	| { ok: true; value: FinalizeValue }
	/** `mismatch` is grand total minus paid total: positive means money is still missing. */
	| { ok: false; errors: FinalizeErrors; mismatch: Poisha | null };

export const finalKey = (userId: string, itemId: string) => `${userId}:${itemId}`;

const takaOf = (raw: string | undefined): Poisha | null => {
	const s = (raw ?? '').trim();
	if (s === '') return 0;
	return parseTaka(s);
};

/** Total final units per item; missing fields fall back to the line's default. */
export function finalUnitsByItem(form: FinalizeForm, ctx: FinalizeContext): Map<string, number> {
	const availableOf = new Map(ctx.items.map((i) => [i.id, i.available]));
	const units = new Map<string, number>();
	for (const line of ctx.lines) {
		const submitted = form.final[finalKey(line.userId, line.itemId)];
		const qty = submitted ?? (availableOf.get(line.itemId) === false ? 0 : line.quantity);
		units.set(line.itemId, (units.get(line.itemId) ?? 0) + qty);
	}
	return units;
}

export function validateFinalize(form: FinalizeForm, ctx: FinalizeContext): FinalizeResult {
	const errors: FinalizeErrors = {};
	const set = (field: string, key: MessageKey) => {
		if (!errors[field]) errors[field] = key;
	};

	// Final quantities: 0–20 for every existing line; missing means the default.
	const availableOf = new Map(ctx.items.map((i) => [i.id, i.available]));
	const final = new Map<string, number>();
	for (const line of ctx.lines) {
		const key = finalKey(line.userId, line.itemId);
		const qty = form.final[key] ?? (availableOf.get(line.itemId) === false ? 0 : line.quantity);
		if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY)
			set(`final:${key}`, 'manage.finalize.error.qtyInvalid');
		else final.set(key, qty);
	}
	const units = finalUnitsByItem(form, ctx);

	// Costs: per-piece price × units, or the entered total for mixed-shop items.
	// An item nobody got costs 0 and ignores its inputs.
	const costs = new Map<string, Poisha>();
	for (const item of ctx.items) {
		const n = units.get(item.id) ?? 0;
		if (n === 0 || !Number.isInteger(n)) {
			costs.set(item.id, 0);
			continue;
		}
		const totalMode = item.id in form.totals;
		const raw = (totalMode ? form.totals[item.id] : form.prices[item.id]) ?? '';
		const field = totalMode ? `total:${item.id}` : `price:${item.id}`;
		if (raw.trim() === '') {
			set(field, 'manage.finalize.error.priceRequired');
			continue;
		}
		const value = parseTaka(raw);
		if (value === null) set(field, 'manage.finalize.error.costInvalid');
		else costs.set(item.id, totalMode ? value : lineTotal(n, value));
	}

	const totalUnits = [...units.values()].reduce((a, b) => a + b, 0);

	// A delivery fee needs at least one eater (someone with a positive final quantity).
	const deliveryFee = takaOf(form.deliveryFee);
	if (deliveryFee === null) set('deliveryFee', 'manage.finalize.error.costInvalid');
	else if (deliveryFee > 0 && totalUnits === 0)
		set('deliveryFee', 'manage.finalize.error.feeNoEaters');

	// A discount needs eaters too, and must not push anyone's share below zero.
	const discount = takaOf(form.discount);
	if (discount === null) set('discount', 'manage.finalize.error.costInvalid');
	else if (discount > 0 && totalUnits === 0) set('discount', 'manage.finalize.error.feeNoEaters');
	else if (discount > 0 && Object.keys(errors).length === 0) {
		const charges = computeCharges(
			ctx.items.map((i) => ({ itemId: i.id, totalCost: costs.get(i.id) ?? 0 })),
			ctx.lines.map((l) => ({
				userId: l.userId,
				itemId: l.itemId,
				finalQuantity: final.get(finalKey(l.userId, l.itemId)) ?? 0
			})),
			deliveryFee ?? 0,
			discount
		);
		if ([...charges.values()].some((c) => c < 0))
			set('discount', 'manage.finalize.error.discountTooHigh');
	}

	// Payments: skip fully empty rows, validate the rest.
	const payments: { userId: string; amount: Poisha }[] = [];
	form.payments.forEach((row, n) => {
		const userId = row.userId.trim();
		const rawAmount = (row.amount ?? '').trim();
		if (!userId && rawAmount === '') return;
		if (!userId) {
			set(`payer:${n}`, 'manage.finalize.error.payerRequired');
			return;
		}
		if (!ctx.payerIds.has(userId)) {
			set(`payer:${n}`, 'manage.finalize.error.payerNotAllowed');
			return;
		}
		if (payments.some((p) => p.userId === userId)) {
			set(`payer:${n}`, 'manage.finalize.error.payerDuplicate');
			return;
		}
		const amount = rawAmount === '' ? 0 : parseTaka(rawAmount);
		if (amount === null || amount <= 0) {
			set(`paid:${n}`, 'manage.finalize.error.paidInvalid');
			return;
		}
		payments.push({ userId, amount });
	});

	const itemsTotal = sum([...costs.values()]);
	const grandTotal = itemsTotal + (deliveryFee ?? 0) - (discount ?? 0);
	const paidTotal = sum(payments.map((p) => p.amount));

	// Money in must equal money spent, to the poisha.
	let mismatch: Poisha | null = null;
	if (grandTotal > 0 && payments.length === 0) {
		set('payments', 'manage.finalize.error.paymentsRequired');
		mismatch = grandTotal;
	} else if (paidTotal !== grandTotal) {
		mismatch = grandTotal - paidTotal;
		set(
			'payments',
			mismatch > 0 ? 'manage.finalize.error.paymentsShort' : 'manage.finalize.error.paymentsOver'
		);
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors, mismatch };

	const fee: Poisha = deliveryFee ?? 0;
	return {
		ok: true,
		value: {
			costs: [...costs].map(([itemId, totalCost]) => ({ itemId, totalCost })),
			final: ctx.lines.map((line) => ({
				userId: line.userId,
				itemId: line.itemId,
				quantity: final.get(finalKey(line.userId, line.itemId))!
			})),
			deliveryFee: fee,
			discount: discount ?? 0,
			payments,
			itemsTotal,
			deliveryFeeTotal: fee,
			grandTotal,
			paidTotal
		}
	};
}
