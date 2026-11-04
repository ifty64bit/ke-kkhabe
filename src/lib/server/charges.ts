import { eq } from 'drizzle-orm';
import { allocate, type Poisha } from '#lib/money.ts';
import { day, dayItem, orderLine } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';

/**
 * Each member's charge for a finalized day.
 * Every item's total cost is split across the units actually eaten (final quantities),
 * so members pay the same per-piece price for an item even when it came from several shops.
 * The day's delivery fee is split equally among everyone who ate anything.
 * Members are processed in user-id order so leftover poisha land the same way every time.
 */
export async function chargesForDay(db: Db, dayId: string): Promise<Map<string, Poisha>> {
	const [[theDay], costs, lines] = await Promise.all([
		db.select({ deliveryFee: day.deliveryFee }).from(day).where(eq(day.id, dayId)).limit(1),
		db
			.select({ itemId: dayItem.itemId, totalCost: dayItem.totalCost })
			.from(dayItem)
			.where(eq(dayItem.dayId, dayId)),
		db
			.select({
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				finalQuantity: orderLine.finalQuantity
			})
			.from(orderLine)
			.where(eq(orderLine.dayId, dayId))
	]);

	const byUser = (a: { userId: string }, b: { userId: string }) =>
		a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
	const charges = new Map<string, Poisha>();
	for (const { itemId, totalCost } of costs) {
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

	const fee = theDay?.deliveryFee ?? 0;
	const eaters = [...charges.keys()].sort();
	if (fee > 0 && eaters.length > 0) {
		const shares = allocate(
			fee,
			eaters.map(() => 1)
		);
		eaters.forEach((id, i) => charges.set(id, (charges.get(id) ?? 0) + shares[i]));
	}
	return charges;
}
