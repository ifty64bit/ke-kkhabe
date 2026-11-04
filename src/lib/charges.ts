import { allocate, type Poisha } from '#lib/money.ts';

/**
 * The pure charge math for a day, shared by the server (`chargesForDay`) and the
 * client-side finalize preview so both always agree. No database or server imports.
 */
export type ChargeItem = { itemId: string; totalCost: Poisha | null };
export type ChargeLine = { userId: string; itemId: string; finalQuantity: number | null };

/**
 * Each member's charge for a day's items and delivery fee.
 * Every item's total cost is split across the units actually eaten (final quantities),
 * so members pay the same per-piece price for an item even when it came from several shops.
 * The delivery fee is added, and the discount taken off, in equal shares among everyone
 * who ate anything (a positive final quantity of any item). Members are processed in
 * user-id order so leftover poisha land the same way every time.
 * A large discount can push a member below zero; `validateFinalize` rejects that case.
 */
/** One member's part of a day: what each item, the delivery fee and the discount added up to. */
export type ChargeBreakdown = {
	/** Item id to this member's share of that item's cost. */
	items: Map<string, Poisha>;
	deliveryShare: Poisha;
	discountShare: Poisha;
	total: Poisha;
};

/**
 * Each member's charge for a day, line by line: per-item shares, delivery share and
 * discount share. Every item's total cost is split across the units actually eaten
 * (final quantities). The delivery fee is added, and the discount taken off, in equal
 * shares among everyone who ate anything. Members are processed in user-id order so
 * leftover poisha land the same way every time.
 * A large discount can push a member below zero; `validateFinalize` rejects that case.
 */
export function computeBreakdown(
	items: ChargeItem[],
	lines: ChargeLine[],
	deliveryFee: Poisha,
	discount: Poisha = 0
): Map<string, ChargeBreakdown> {
	const byUser = (a: { userId: string }, b: { userId: string }) =>
		a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
	const out = new Map<string, ChargeBreakdown>();
	const of = (userId: string) => {
		let b = out.get(userId);
		if (!b) {
			b = { items: new Map(), deliveryShare: 0, discountShare: 0, total: 0 };
			out.set(userId, b);
		}
		return b;
	};

	for (const { itemId, totalCost } of items) {
		const eaten = lines
			.filter((l) => l.itemId === itemId && (l.finalQuantity ?? 0) > 0)
			.toSorted(byUser);
		if (eaten.length === 0) continue;
		const shares = allocate(
			totalCost ?? 0,
			eaten.map((l) => l.finalQuantity ?? 0)
		);
		eaten.forEach((l, i) => {
			const b = of(l.userId);
			b.items.set(itemId, (b.items.get(itemId) ?? 0) + shares[i]);
			b.total += shares[i];
		});
	}

	const eaters = [...out.keys()].sort();
	const each = (amount: Poisha) =>
		amount > 0 && eaters.length > 0
			? allocate(
					amount,
					eaters.map(() => 1)
				)
			: eaters.map(() => 0);
	const fees = each(deliveryFee);
	const discounts = each(discount);
	eaters.forEach((id, i) => {
		const b = out.get(id)!;
		b.deliveryShare = fees[i];
		b.discountShare = discounts[i];
		b.total += fees[i] - discounts[i];
	});
	return out;
}

/** Each member's charge for a day (the totals of `computeBreakdown`). */
export function computeCharges(
	items: ChargeItem[],
	lines: ChargeLine[],
	deliveryFee: Poisha,
	discount: Poisha = 0
): Map<string, Poisha> {
	return new Map(
		[...computeBreakdown(items, lines, deliveryFee, discount)].map(([id, b]) => [id, b.total])
	);
}
