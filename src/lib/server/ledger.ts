import { and, eq, isNull } from 'drizzle-orm';
import { balancesFrom, openDays } from '#lib/ledger.ts';
import { billPayment, day, dayItem, orderLine, settlement } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';

/**
 * Everyone's balance, computed once for all finalized days plus live settlements.
 * Loads each table once (joined down to finalized days where it matters) and folds
 * everything in memory through the pure `balancesFrom`; per-day `chargesForDay`
 * calls would be N queries that grow forever.
 */
export async function computeLedger(db: Db) {
	const [days, items, lines, payments, settlements] = await Promise.all([
		db
			.select({ id: day.id, date: day.date, deliveryFee: day.deliveryFee, discount: day.discount })
			.from(day)
			.where(eq(day.status, 'finalized')),
		db
			.select({ dayId: dayItem.dayId, itemId: dayItem.itemId, totalCost: dayItem.totalCost })
			.from(dayItem)
			.innerJoin(day, eq(day.id, dayItem.dayId))
			.where(eq(day.status, 'finalized')),
		db
			.select({
				dayId: orderLine.dayId,
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				finalQuantity: orderLine.finalQuantity12ths
			})
			.from(orderLine)
			.innerJoin(day, eq(day.id, orderLine.dayId))
			.where(eq(day.status, 'finalized')),
		db
			.select({ dayId: billPayment.dayId, userId: billPayment.userId, amount: billPayment.amount })
			.from(billPayment)
			.innerJoin(day, eq(day.id, billPayment.dayId))
			.where(eq(day.status, 'finalized')),
		db
			.select({
				id: settlement.id,
				fromUserId: settlement.fromUserId,
				toUserId: settlement.toUserId,
				amount: settlement.amount,
				voidedAt: settlement.voidedAt,
				status: settlement.status
			})
			.from(settlement)
			.where(and(isNull(settlement.voidedAt), eq(settlement.status, 'approved')))
	]);

	const input = { days, items, lines, payments, settlements };
	const balances = balancesFrom(input);
	return { balances, openDays: openDays(input, balances), hasFinalized: days.length > 0 };
}
