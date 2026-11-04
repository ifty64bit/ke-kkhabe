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
export function computeCharges(
	items: ChargeItem[],
	lines: ChargeLine[],
	deliveryFee: Poisha,
	discount: Poisha = 0
): Map<string, Poisha> {
	const byUser = (a: { userId: string }, b: { userId: string }) =>
		a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
	const charges = new Map<string, Poisha>();
	for (const { itemId, totalCost } of items) {
		const eaten = lines
			.filter((l) => l.itemId === itemId && (l.finalQuantity ?? 0) > 0)
			.toSorted(byUser);
		if (eaten.length === 0) continue;
		const shares = allocate(
			totalCost ?? 0,
			eaten.map((l) => l.finalQuantity ?? 0)
		);
		eaten.forEach((l, i) => charges.set(l.userId, (charges.get(l.userId) ?? 0) + shares[i]));
	}

	const eaters = [...charges.keys()].sort();
	const each = (amount: Poisha, sign: 1 | -1) => {
		if (amount <= 0 || eaters.length === 0) return;
		const shares = allocate(
			amount,
			eaters.map(() => 1)
		);
		eaters.forEach((id, i) => charges.set(id, (charges.get(id) ?? 0) + sign * shares[i]));
	};
	each(deliveryFee, 1);
	each(discount, -1);
	return charges;
}
