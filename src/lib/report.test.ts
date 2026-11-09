import { describe, expect, it } from 'vitest';
import { computeBreakdown } from '#lib/charges.ts';
import {
	buildMonthReport,
	calendarWeeks,
	datesOfMonth,
	type DayStatus,
	type MonthInput
} from '#lib/report.ts';

const users = [
	{ id: 'a', name: 'Ayesha', image: null, active: true },
	{ id: 'b', name: 'Bashir', image: null, active: true },
	{ id: 'z', name: 'Zahid', image: null, active: false }
];

const monthInput = (over: Partial<MonthInput> = {}): MonthInput => ({
	month: '2026-11',
	days: [],
	dayItems: [],
	lines: [],
	responses: [],
	payments: [],
	users,
	...over
});

const day = (
	id: string,
	date: string,
	status: DayStatus = 'open',
	extra: Partial<{ deliveryFee: number; discount: number }> = {}
) => ({ id, date, status, deliveryFee: 0, discount: 0, ...extra });

const dayItem = (dayId: string, itemId: string, totalCost: number | null, name = itemId) => ({
	dayId,
	itemId,
	name,
	unitBn: 'টি',
	unitEn: 'pc',
	totalCost
});

const line = (
	dayId: string,
	userId: string,
	itemId: string,
	quantity12ths: number,
	finalQuantity12ths: number | null = null
) => ({ dayId, userId, itemId, quantity12ths, finalQuantity12ths });

const response = (dayId: string, userId: string, eating: boolean) => ({ dayId, userId, eating });

const payment = (dayId: string, userId: string, amount: number) => ({ dayId, userId, amount });

describe('datesOfMonth', () => {
	it('lists every date of a 28-day February', () => {
		const dates = datesOfMonth('2026-02');
		expect(dates).toHaveLength(28);
		expect(dates[0]).toBe('2026-02-01');
		expect(dates.at(-1)).toBe('2026-02-28');
	});

	it('lists 29 days in a leap February', () => {
		const dates = datesOfMonth('2028-02');
		expect(dates).toHaveLength(29);
		expect(dates.at(-1)).toBe('2028-02-29');
	});
});

describe('calendarWeeks', () => {
	it('starts weeks on Saturday, with 1 November 2026 in the Sunday slot', () => {
		const weeks = calendarWeeks('2026-11');
		expect(weeks[0]).toEqual([
			null,
			'2026-11-01',
			'2026-11-02',
			'2026-11-03',
			'2026-11-04',
			'2026-11-05',
			'2026-11-06'
		]);
	});

	it('pads every week to seven entries and keeps the dates in order', () => {
		const weeks = calendarWeeks('2026-11');
		expect(weeks).toHaveLength(5);
		expect(weeks.every((week) => week.length === 7)).toBe(true);
		expect(weeks.flat().filter(Boolean)).toEqual(datesOfMonth('2026-11'));
	});
});

describe('buildMonthReport: square states', () => {
	const input = monthInput({
		days: [
			day('d1', '2026-11-02', 'open'),
			day('d2', '2026-11-03', 'finalized'),
			day('d3', '2026-11-04', 'finalized'),
			day('d4', '2026-11-05', 'finalized'),
			day('d5', '2026-11-06', 'open'),
			day('d6', '2026-11-09', 'closed'),
			day('d7', '2026-11-10', 'draft')
		],
		dayItems: [dayItem('d1', 'p', 1200), dayItem('d2', 'p', 1200), dayItem('d7', 'p', 1200)],
		lines: [
			line('d1', 'a', 'p', 12),
			line('d2', 'a', 'p', 12, 24),
			line('d3', 'a', 'p', 12, 0),
			line('d4', 'a', 'p', 12, 0),
			line('d7', 'a', 'p', 12)
		],
		responses: [
			response('d1', 'a', true),
			response('d2', 'a', true),
			response('d3', 'a', false),
			response('d4', 'a', true),
			response('d5', 'a', false)
		]
	});
	const report = buildMonthReport(input, ['a']);
	const cells = report.people[0].cells;

	it('treats a positive ordered quantity on an open day as ate', () => {
		expect(cells['2026-11-02'].state).toBe('ate');
		expect(cells['2026-11-02'].final).toBe(false);
		expect(cells['2026-11-02'].lines[0].quantity12ths).toBe(12);
	});

	it("uses the final quantity on a finalized day, and it beats the day's ordered quantity", () => {
		expect(cells['2026-11-03'].state).toBe('ate');
		expect(cells['2026-11-03'].lines[0].quantity12ths).toBe(24);
	});

	it('treats a finalized final quantity of 0 as not ate: skipped when they said no', () => {
		expect(cells['2026-11-04'].state).toBe('skipped');
	});

	it('treats a finalized final quantity of 0 as noAnswer when they had answered yes', () => {
		expect(cells['2026-11-05'].state).toBe('noAnswer');
	});

	it('treats a false response with no lines as skipped', () => {
		expect(cells['2026-11-06'].state).toBe('skipped');
	});

	it('treats a day with no response and no lines as noAnswer', () => {
		expect(cells['2026-11-09'].state).toBe('noAnswer');
	});

	it('leaves out draft days entirely, and the days list has only non-draft days', () => {
		expect(cells['2026-11-10']).toBeUndefined();
		expect(report.days.map((d) => d.date)).toEqual([
			'2026-11-02',
			'2026-11-03',
			'2026-11-04',
			'2026-11-05',
			'2026-11-06',
			'2026-11-09'
		]);
	});

	it('has no cells for dates with no day', () => {
		expect(cells['2026-11-07']).toBeUndefined();
	});
});

describe('buildMonthReport: charges on a finalized day', () => {
	const items = [
		{ itemId: 'p', totalCost: 12000 },
		{ itemId: 't', totalCost: 1000 }
	];
	const lines = [
		{ userId: 'a', itemId: 'p', finalQuantity: 72 },
		{ userId: 'a', itemId: 't', finalQuantity: 6 },
		{ userId: 'b', itemId: 'p', finalQuantity: 48 }
	];
	const deliveryFee = 3000;
	const discount = 2000;
	const breakdown = computeBreakdown(items, lines, deliveryFee, discount);

	const report = buildMonthReport(
		monthInput({
			days: [day('d1', '2026-11-12', 'finalized', { deliveryFee, discount })],
			dayItems: [dayItem('d1', 'p', 12000, 'Paratha'), dayItem('d1', 't', 1000, 'Tea')],
			lines: [
				line('d1', 'a', 'p', 72, 72),
				line('d1', 'a', 't', 6, 6),
				line('d1', 'b', 'p', 48, 48)
			]
		}),
		'all'
	);
	const a = report.people.find((p) => p.id === 'a')!;
	const b = report.people.find((p) => p.id === 'b')!;
	const cell = a.cells['2026-11-12'];

	it("uses computeBreakdown for the member's day charge", () => {
		expect(cell.charge).toBe(breakdown.get('a')!.total);
		expect(b.cells['2026-11-12'].charge).toBe(breakdown.get('b')!.total);
	});

	it('matches the per-item shares', () => {
		const shares = Object.fromEntries(cell.lines.map((l) => [l.itemId, l.share]));
		expect(shares).toEqual(Object.fromEntries(breakdown.get('a')!.items));
	});

	it('matches the delivery and discount shares', () => {
		expect(cell.deliveryShare).toBe(breakdown.get('a')!.deliveryShare);
		expect(cell.discountShare).toBe(breakdown.get('a')!.discountShare);
	});

	it('carries the item name and units for display', () => {
		expect(cell.lines.map((l) => [l.name, l.unitBn, l.unitEn, l.quantity12ths])).toEqual([
			['Paratha', 'টি', 'pc', 72],
			['Tea', 'টি', 'pc', 6]
		]);
	});

	it('charges a member who did not eat nothing on a finalized day', () => {
		const z = report.people.find((p) => p.id === 'z');
		expect(z).toBeUndefined(); // inactive and no data
		const c = buildMonthReport(
			monthInput({
				days: [day('d1', '2026-11-12', 'finalized')],
				dayItems: [dayItem('d1', 'p', 12000)],
				lines: [line('d1', 'a', 'p', 72, 72)]
			}),
			'all'
		);
		const bashir = c.people.find((p) => p.id === 'b')!;
		expect(bashir.cells['2026-11-12'].charge).toBe(0);
		expect(bashir.cells['2026-11-12'].state).toBe('noAnswer');
	});
});

describe('buildMonthReport: bill payments and totals', () => {
	const report = buildMonthReport(
		monthInput({
			days: [
				day('d1', '2026-11-02', 'open'),
				day('d2', '2026-11-03', 'finalized'),
				day('d3', '2026-11-04', 'finalized')
			],
			dayItems: [dayItem('d2', 'p', 1200), dayItem('d3', 'p', 1200)],
			lines: [line('d1', 'a', 'p', 12), line('d2', 'a', 'p', 12, 12), line('d3', 'b', 'p', 12, 12)],
			responses: [response('d1', 'a', true), response('d2', 'a', true), response('d3', 'b', true)],
			payments: [payment('d1', 'a', 5000), payment('d2', 'a', 15000), payment('d3', 'b', 2000)]
		}),
		'all'
	);
	const a = report.people.find((p) => p.id === 'a')!;
	const b = report.people.find((p) => p.id === 'b')!;

	it('shows the day bill payment in the cell', () => {
		expect(a.cells['2026-11-02'].paid).toBe(5000);
		expect(a.cells['2026-11-03'].paid).toBe(15000);
	});

	it("counts a member's paid total on finalized days only", () => {
		expect(a.totals.paid).toBe(15000);
		expect(b.totals.paid).toBe(2000);
	});

	it('counts ate cells for days eaten, including open days', () => {
		expect(a.totals.daysEaten).toBe(2);
		expect(b.totals.daysEaten).toBe(1);
	});

	it('sums charged money on finalized days only', () => {
		expect(a.totals.charged).toBe(1200);
		expect(b.totals.charged).toBe(1200);
	});

	it('sums the office totals across everyone included', () => {
		expect(report.totals).toEqual({ breakfastDays: 3, charged: 2400, paid: 17000 });
	});
});

describe('buildMonthReport: who appears', () => {
	it("keeps a member's report to that member only", () => {
		const report = buildMonthReport(monthInput(), ['b']);
		expect(report.people.map((p) => p.id)).toEqual(['b']);
	});

	it('includes every active member, even with no data', () => {
		const report = buildMonthReport(monthInput(), 'all');
		expect(report.people.map((p) => p.name)).toEqual(['Ayesha', 'Bashir']);
	});

	it('leaves out an inactive member with no data that month', () => {
		const report = buildMonthReport(monthInput(), 'all');
		expect(report.people.some((p) => p.id === 'z')).toBe(false);
	});

	it('includes an inactive member who has data that month, after active members', () => {
		const report = buildMonthReport(
			monthInput({
				days: [day('d1', '2026-11-02', 'open')],
				responses: [response('d1', 'z', false)]
			}),
			'all'
		);
		expect(report.people.map((p) => p.name)).toEqual(['Ayesha', 'Bashir', 'Zahid']);
	});
});
