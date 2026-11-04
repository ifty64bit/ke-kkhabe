import { describe, expect, it } from 'vitest';
import { parseOrderForm } from '#lib/server/orders.ts';

const form = (entries: [string, string][]) => {
	const f = new FormData();
	for (const [k, v] of entries) f.append(k, v);
	return f;
};
const allowed = new Set(['dal', 'parata']);

describe('parseOrderForm', () => {
	it('reads quantities in twelfths and skips zeros', () => {
		expect(
			parseOrderForm(
				form([
					['qty:dal', '6'],
					['qty:parata', '24'],
					['qty:x', '0'],
					['note', 'hi']
				]),
				new Set([...allowed, 'x'])
			)
		).toEqual([
			{ itemId: 'dal', quantity: 6 },
			{ itemId: 'parata', quantity: 24 }
		]);
	});

	it('rejects twelfths that are not an allowed fraction, or too many', () => {
		for (const bad of ['5', '7', '241', '250', 'abc', '-6', '1.5'])
			expect(parseOrderForm(form([['qty:dal', bad]]), allowed)).toBeNull();
	});

	it('rejects items not on the menu', () => {
		expect(parseOrderForm(form([['qty:murgi', '12']]), allowed)).toBeNull();
	});

	it('rejects the same item twice', () => {
		expect(
			parseOrderForm(
				form([
					['qty:dal', '6'],
					['qty:dal', '12']
				]),
				allowed
			)
		).toBeNull();
	});
});
