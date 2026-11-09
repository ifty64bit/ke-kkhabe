import { between, eq } from 'drizzle-orm';
import { datesOfMonth, type MonthInput } from '#lib/report.ts';
import {
	billPayment,
	day,
	dayItem,
	item,
	orderLine,
	response,
	user
} from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';

/**
 * Every row the report needs for one month, loaded with one query per table.
 * Children are joined to `day` and bounded by the month's date range, so no query
 * runs per day and the cost does not grow with the number of days.
 */
export async function loadMonthInput(db: Db, month: string): Promise<MonthInput> {
	const dates = datesOfMonth(month);
	const first = dates[0];
	const last = dates[dates.length - 1];
	const inMonth = between(day.date, first, last);

	const [days, dayItems, lines, responses, payments, users] = await Promise.all([
		db
			.select({
				id: day.id,
				date: day.date,
				status: day.status,
				deliveryFee: day.deliveryFee,
				discount: day.discount
			})
			.from(day)
			.where(inMonth),
		db
			.select({
				dayId: dayItem.dayId,
				itemId: dayItem.itemId,
				name: item.name,
				unitBn: item.unitBn,
				unitEn: item.unitEn,
				totalCost: dayItem.totalCost
			})
			.from(dayItem)
			.innerJoin(day, eq(day.id, dayItem.dayId))
			.innerJoin(item, eq(item.id, dayItem.itemId))
			.where(inMonth),
		db
			.select({
				dayId: orderLine.dayId,
				userId: orderLine.userId,
				itemId: orderLine.itemId,
				quantity12ths: orderLine.quantity12ths,
				finalQuantity12ths: orderLine.finalQuantity12ths
			})
			.from(orderLine)
			.innerJoin(day, eq(day.id, orderLine.dayId))
			.where(inMonth),
		db
			.select({
				dayId: response.dayId,
				userId: response.userId,
				eating: response.eating
			})
			.from(response)
			.innerJoin(day, eq(day.id, response.dayId))
			.where(inMonth),
		db
			.select({
				dayId: billPayment.dayId,
				userId: billPayment.userId,
				amount: billPayment.amount
			})
			.from(billPayment)
			.innerJoin(day, eq(day.id, billPayment.dayId))
			.where(inMonth),
		db
			.select({
				id: user.id,
				name: user.name,
				image: user.image,
				active: user.active
			})
			.from(user)
	]);

	return {
		month,
		days,
		dayItems,
		lines,
		responses,
		payments,
		users: users.map((u) => ({ ...u, active: u.active !== false }))
	};
}
