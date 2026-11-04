import { eq } from 'drizzle-orm';
import { allocate, type Poisha } from '#lib/money.ts';
import { dayItem, orderLine } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';

/**
 * Each member's charge for a finalized day.
 * Every item's total cost is split across the units actually eaten (final quantities),
 * so members pay the same per-piece price for an item even when it came from several shops.
 * Members are processed in user-id order so leftover poisha land the same way every time.
 */
export async function chargesForDay(db: Db, dayId: string): Promise<Map<string, Poisha>> {
	const [costs, lines] = await Promise.all([
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

	const charges = new Map<string, Poisha>();
	for (const { itemId, totalCost } of costs) {
		const eaten = lines
			.filter((l) => l.itemId === itemId && (l.finalQuantity ?? 0) > 0)
			.toSorted((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
		if (eaten.length === 0) continue;
		const shares = allocate(
			totalCost ?? 0,
			eaten.map((l) => l.finalQuantity ?? 0)
		);
		eaten.forEach((l, i) => charges.set(l.userId, (charges.get(l.userId) ?? 0) + shares[i]));
	}
	return charges;
}
