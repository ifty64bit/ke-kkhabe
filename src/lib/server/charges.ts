import { eq } from 'drizzle-orm';
import { computeBreakdown, computeCharges } from '#lib/charges.ts';
import type { Poisha } from '#lib/money.ts';
import { day, dayItem, orderLine } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';

/**
 * Each member's charge for a finalized day.
 * Every item's total cost is split across the units actually eaten (final quantities),
 * so members pay the same per-piece price for an item even when it came from several shops.
 * The day's delivery fee and discount are split equally among everyone who ate anything.
 */
export async function chargesForDay(db: Db, dayId: string): Promise<Map<string, Poisha>> {
	const [[theDay], costs, lines] = await Promise.all([
		db
			.select({ deliveryFee: day.deliveryFee, discount: day.discount })
			.from(day)
			.where(eq(day.id, dayId))
			.limit(1),
		db
			.select({ itemId: dayItem.itemId, totalCost: dayItem.totalCost })
			.from(dayItem)
			.where(eq(dayItem.dayId, dayId)),
		db
			.select({
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				finalQuantity: orderLine.finalQuantity12ths
			})
			.from(orderLine)
			.where(eq(orderLine.dayId, dayId))
	]);
	return computeCharges(costs, lines, theDay?.deliveryFee ?? 0, theDay?.discount ?? 0);
}

/** Each member's line-by-line charge for a day (for receipts). */
export async function breakdownForDay(db: Db, dayId: string) {
	const [[theDay], costs, lines] = await Promise.all([
		db
			.select({ deliveryFee: day.deliveryFee, discount: day.discount })
			.from(day)
			.where(eq(day.id, dayId))
			.limit(1),
		db
			.select({ itemId: dayItem.itemId, totalCost: dayItem.totalCost })
			.from(dayItem)
			.where(eq(dayItem.dayId, dayId)),
		db
			.select({
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				finalQuantity: orderLine.finalQuantity12ths
			})
			.from(orderLine)
			.where(eq(orderLine.dayId, dayId))
	]);
	return computeBreakdown(costs, lines, theDay?.deliveryFee ?? 0, theDay?.discount ?? 0);
}
