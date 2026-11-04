import { describe, expect, it } from 'vitest';
import { computeCharges } from '#lib/charges.ts';
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
