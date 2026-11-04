import { describe, expect, it } from 'vitest';
import { computeBreakdown, computeCharges } from '#lib/charges.ts';
import { sum } from '#lib/money.ts';

const item = (itemId: string, totalCost: number | null) => ({ itemId, totalCost });
const line = (userId: string, itemId: string, finalQuantity: number | null) => ({
	userId,
	itemId,
	finalQuantity
});

describe('computeCharges', () => {
	it('splits an item cost across final quantities', () => {
		const charges = computeCharges([item('a', 1000)], [line('u1', 'a', 3), line('u2', 'a', 1)], 0);
		expect(charges.get('u1')).toBe(750);
		expect(charges.get('u2')).toBe(250);
	});

	it('splits the delivery fee equally among eaters, whole poisha adding up', () => {
		const charges = computeCharges(
			[item('a', 1000)],
			[line('u1', 'a', 1), line('u2', 'a', 1), line('u3', 'a', 1)],
			100
		);
		// Item: 1000/3 → 334, 333, 333. Fee: 100/3 → 34, 33, 33. All in user-id order.
		expect(charges.get('u1')).toBe(368);
		expect(charges.get('u2')).toBe(366);
		expect(charges.get('u3')).toBe(366);
		expect(sum([...charges.values()])).toBe(1100);
	});

	it('leaves out members who ate nothing', () => {
		const charges = computeCharges(
			[item('a', 1000)],
			[line('u1', 'a', 2), line('u2', 'a', 0), line('u3', 'a', null)],
			0
		);
		expect([...charges.keys()]).toEqual(['u1']);
	});

	it('registers eaters of a free item so they still share the fee', () => {
		const charges = computeCharges(
			[item('paid', 500), item('free', 0)],
			[line('u1', 'paid', 1), line('u2', 'free', 2)],
			90
		);
		expect(charges.get('u1')).toBe(500 + 45);
		expect(charges.get('u2')).toBe(45);
	});

	it('charges nobody when nobody ate, even with a fee (server validation rejects this)', () => {
		const charges = computeCharges([item('a', 500)], [line('u1', 'a', 0)], 90);
		expect(charges.size).toBe(0);
	});

	it('is reproducible: leftover poisha land the same way for sorted users', () => {
		const lines = [line('u2', 'a', 1), line('u1', 'a', 1), line('u3', 'a', 1)];
		const first = computeCharges([item('a', 101)], lines, 0);
		const second = computeCharges([item('a', 101)], [...lines].reverse(), 0);
		expect([...first.entries()]).toEqual([...second.entries()]);
	});
});

describe('computeCharges: discount', () => {
	// Paratha ৳120 over 12 (A 6, B 4, C 2); delivery ৳30; discount ৳20.
	const items = [{ itemId: 'p', totalCost: 12000 }];
	const lines = [
		{ userId: 'a', itemId: 'p', finalQuantity: 6 },
		{ userId: 'b', itemId: 'p', finalQuantity: 4 },
		{ userId: 'c', itemId: 'p', finalQuantity: 2 },
		{ userId: 'd', itemId: 'p', finalQuantity: 0 }
	];

	it('takes the discount off in equal shares among people who ate', () => {
		const charges = computeCharges(items, lines, 3000, 2000);
		// Food 6000/4000/2000, +1000 delivery each, −666.67 discount each (leftover poisha first by id).
		expect(charges.get('a')).toBe(6000 + 1000 - 667);
		expect(charges.get('b')).toBe(4000 + 1000 - 667);
		expect(charges.get('c')).toBe(2000 + 1000 - 666);
		expect(charges.has('d')).toBe(false);
	});

	it('charges add up to food + delivery − discount exactly', () => {
		const charges = computeCharges(items, lines, 3000, 2000);
		expect(sum([...charges.values()])).toBe(12000 + 3000 - 2000);
	});

	it('defaults to no discount', () => {
		expect(computeCharges(items, lines, 0)).toEqual(computeCharges(items, lines, 0, 0));
	});
});

describe('computeBreakdown', () => {
	const items = [
		{ itemId: 'p', totalCost: 12000 },
		{ itemId: 't', totalCost: 1000 }
	];
	const lines = [
		{ userId: 'a', itemId: 'p', finalQuantity: 6 },
		{ userId: 'b', itemId: 'p', finalQuantity: 6 },
		{ userId: 'b', itemId: 't', finalQuantity: 1 }
	];

	it("each member's lines add up exactly to their total", () => {
		for (const b of computeBreakdown(items, lines, 3001, 999).values()) {
			const itemsSum = [...b.items.values()].reduce((x, y) => x + y, 0);
			expect(itemsSum + b.deliveryShare - b.discountShare).toBe(b.total);
		}
	});

	it('totals match computeCharges', () => {
		const breakdown = computeBreakdown(items, lines, 3001, 999);
		const charges = computeCharges(items, lines, 3001, 999);
		for (const [id, b] of breakdown) expect(b.total).toBe(charges.get(id));
	});

	it('lists only the items a member ate', () => {
		const a = computeBreakdown(items, lines, 0).get('a')!;
		expect([...a.items.keys()]).toEqual(['p']);
	});
});
