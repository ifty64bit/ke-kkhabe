import { computeBreakdown, type ChargeBreakdown } from '#lib/charges.ts';
import type { Poisha } from '#lib/money.ts';
import type { DayStatus } from '#lib/server/db/schema.ts';

export type { DayStatus };

/**
 * The raw rows for one month, already bounded to it by the server loader.
 * Everything here is database-shaped; `buildMonthReport` folds it into display rows.
 */
export type MonthDayInput = {
	id: string;
	date: string;
	status: DayStatus;
	deliveryFee: Poisha;
	discount: Poisha;
};

export type MonthDayItemInput = {
	dayId: string;
	itemId: string;
	name: string;
	unitBn: string;
	unitEn: string | null;
	totalCost: Poisha | null;
};

export type MonthLineInput = {
	dayId: string;
	userId: string;
	itemId: string;
	quantity12ths: number;
	finalQuantity12ths: number | null;
};

export type MonthResponseInput = { dayId: string; userId: string; eating: boolean };
export type MonthPaymentInput = { dayId: string; userId: string; amount: Poisha };
export type MonthUserInput = { id: string; name: string; image: string | null; active: boolean };

export type MonthInput = {
	month: string;
	days: MonthDayInput[];
	dayItems: MonthDayItemInput[];
	lines: MonthLineInput[];
	responses: MonthResponseInput[];
	payments: MonthPaymentInput[];
	users: MonthUserInput[];
};

export type CellState = 'ate' | 'skipped' | 'noAnswer' | 'noBreakfast';

export type CellLine = {
	itemId: string;
	name: string;
	unitBn: string;
	unitEn: string | null;
	quantity12ths: number;
	share: Poisha | null;
};

export type Cell = {
	state: CellState;
	final: boolean;
	lines: CellLine[];
	deliveryShare: Poisha;
	discountShare: Poisha;
	charge: Poisha | null;
	paid: Poisha;
};

export type PersonMonth = {
	id: string;
	name: string;
	image: string | null;
	active: boolean;
	cells: Record<string, Cell>;
	totals: { daysEaten: number; charged: Poisha; paid: Poisha };
};

export type MonthReport = {
	month: string;
	dates: string[];
	days: { date: string; status: DayStatus }[];
	people: PersonMonth[];
	totals: { breakfastDays: number; charged: Poisha; paid: Poisha };
};

const parseMonth = (month: string) => {
	const match = /^(\d{4})-(\d{2})$/.exec(month);
	const year = Number(match?.[1]);
	const index = Number(match?.[2]) - 1;
	if (!match || index < 0 || index > 11) throw new Error(`Invalid month: ${month}`);
	return { year, index };
};

/** Every date of a YYYY-MM month, as YYYY-MM-DD. */
export function datesOfMonth(month: string): string[] {
	const { year, index } = parseMonth(month);
	const count = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
	return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * The month laid out in Saturday-first weeks for a 7-column calendar.
 * A week starts on Saturday, so a Sunday the 1st leaves one blank at the front.
 */
export function calendarWeeks(month: string): (string | null)[][] {
	const dates = datesOfMonth(month);
	const firstDay = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
	const lead = (firstDay + 1) % 7;
	const cells: (string | null)[] = [...Array<string | null>(lead).fill(null), ...dates];
	while (cells.length % 7 !== 0) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

const byName = (a: MonthUserInput, b: MonthUserInput) =>
	Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name);

/**
 * Build one month's report for the given people (`'all'` adds every active member
 * and inactive members who have any data that month).
 * A day that does not exist, or is still a draft, has no cell; the calendar draws it empty.
 * Money on a cell comes from the same `computeBreakdown` the ledger uses, so the two agree.
 */
export function buildMonthReport(input: MonthInput, userIds: string[] | 'all'): MonthReport {
	const prefix = `${input.month}-`;
	const days = input.days
		.filter((d) => d.status !== 'draft' && d.date.startsWith(prefix))
		.toSorted((a, b) => a.date.localeCompare(b.date));
	const dayById = new Map(days.map((d) => [d.id, d]));

	const itemsByDay = new Map<string, MonthDayItemInput[]>();
	for (const item of input.dayItems) {
		if (!dayById.has(item.dayId)) continue;
		const list = itemsByDay.get(item.dayId);
		if (list) list.push(item);
		else itemsByDay.set(item.dayId, [item]);
	}

	const linesByDayUser = new Map<string, Map<string, Map<string, MonthLineInput>>>();
	for (const line of input.lines) {
		if (!dayById.has(line.dayId)) continue;
		let byUser = linesByDayUser.get(line.dayId);
		if (!byUser) linesByDayUser.set(line.dayId, (byUser = new Map()));
		let byItem = byUser.get(line.userId);
		if (!byItem) byUser.set(line.userId, (byItem = new Map()));
		byItem.set(line.itemId, line);
	}

	const responsesByDay = new Map<string, Map<string, boolean>>();
	for (const response of input.responses) {
		if (!dayById.has(response.dayId)) continue;
		let byUser = responsesByDay.get(response.dayId);
		if (!byUser) responsesByDay.set(response.dayId, (byUser = new Map()));
		byUser.set(response.userId, response.eating);
	}

	const paymentsByDayUser = new Map<string, Map<string, Poisha>>();
	for (const payment of input.payments) {
		if (!dayById.has(payment.dayId)) continue;
		let byUser = paymentsByDayUser.get(payment.dayId);
		if (!byUser) paymentsByDayUser.set(payment.dayId, (byUser = new Map()));
		byUser.set(payment.userId, (byUser.get(payment.userId) ?? 0) + payment.amount);
	}

	const breakdowns = new Map<string, Map<string, ChargeBreakdown>>();
	for (const d of days) {
		if (d.status !== 'finalized') continue;
		const dayLines: MonthLineInput[] = [];
		for (const byItem of linesByDayUser.get(d.id)?.values() ?? [])
			dayLines.push(...byItem.values());
		breakdowns.set(
			d.id,
			computeBreakdown(
				(itemsByDay.get(d.id) ?? []).map((i) => ({ itemId: i.itemId, totalCost: i.totalCost })),
				dayLines.map((l) => ({
					userId: l.userId,
					itemId: l.itemId,
					finalQuantity: l.finalQuantity12ths
				})),
				d.deliveryFee,
				d.discount
			)
		);
	}

	const usersWithData = new Set<string>();
	for (const rows of [input.responses, input.lines, input.payments]) {
		for (const row of rows) if (dayById.has(row.dayId)) usersWithData.add(row.userId);
	}
	const wanted = userIds === 'all' ? null : new Set(userIds);
	const people = input.users
		.filter((u) => (wanted ? wanted.has(u.id) : u.active !== false || usersWithData.has(u.id)))
		.toSorted(byName);

	const peopleMonths: PersonMonth[] = people.map((person) => {
		const cells: Record<string, Cell> = {};
		const totals = { daysEaten: 0, charged: 0, paid: 0 };
		for (const d of days) {
			const final = d.status === 'finalized';
			const breakdown = breakdowns.get(d.id)?.get(person.id);
			const userLines = linesByDayUser.get(d.id)?.get(person.id);
			const quantityOf = (line: MonthLineInput) =>
				final ? (line.finalQuantity12ths ?? 0) : line.quantity12ths;

			const lines: CellLine[] = [];
			for (const item of itemsByDay.get(d.id) ?? []) {
				const line = userLines?.get(item.itemId);
				if (!line) continue;
				const quantity12ths = quantityOf(line);
				if (quantity12ths <= 0) continue;
				lines.push({
					itemId: item.itemId,
					name: item.name,
					unitBn: item.unitBn,
					unitEn: item.unitEn,
					quantity12ths,
					share: final ? (breakdown?.items.get(item.itemId) ?? 0) : null
				});
			}

			let ate = false;
			for (const line of userLines?.values() ?? []) {
				if (quantityOf(line) > 0) {
					ate = true;
					break;
				}
			}
			const state: CellState = ate
				? 'ate'
				: responsesByDay.get(d.id)?.get(person.id) === false
					? 'skipped'
					: 'noAnswer';

			const cell: Cell = {
				state,
				final,
				lines,
				deliveryShare: final ? (breakdown?.deliveryShare ?? 0) : 0,
				discountShare: final ? (breakdown?.discountShare ?? 0) : 0,
				charge: final ? (breakdown?.total ?? 0) : null,
				paid: paymentsByDayUser.get(d.id)?.get(person.id) ?? 0
			};
			cells[d.date] = cell;
			if (state === 'ate') totals.daysEaten += 1;
			if (final) {
				totals.charged += cell.charge ?? 0;
				totals.paid += cell.paid;
			}
		}
		return {
			id: person.id,
			name: person.name,
			image: person.image,
			active: person.active !== false,
			cells,
			totals
		};
	});

	return {
		month: input.month,
		dates: datesOfMonth(input.month),
		days: days.map((d) => ({ date: d.date, status: d.status })),
		people: peopleMonths,
		totals: {
			breakfastDays: days.length,
			charged: peopleMonths.reduce((total, p) => total + p.totals.charged, 0),
			paid: peopleMonths.reduce((total, p) => total + p.totals.paid, 0)
		}
	};
}
