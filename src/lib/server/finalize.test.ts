import { describe, expect, it } from 'vitest';
import {
	finalKey,
	finalUnitsByItem,
	validateFinalize,
	type FinalizeContext,
	type FinalizeForm
} from '#lib/server/finalize.ts';

// Paratha: u1 ×2, u2 ×3 (5 pcs). Egg: u1 ×1. Chicken is unavailable, so u3's line defaults to 0.
const ctx: FinalizeContext = {
	items: [
		{ id: 'parata', available: true },
		{ id: 'dim', available: true },
		{ id: 'murgi', available: false }
	],
	lines: [
		{ userId: 'u1', itemId: 'parata', quantity: 2 },
		{ userId: 'u2', itemId: 'parata', quantity: 3 },
		{ userId: 'u1', itemId: 'dim', quantity: 1 },
		{ userId: 'u3', itemId: 'murgi', quantity: 1 }
	],
	payerIds: new Set(['u1', 'u2', 'manager'])
};

// ৳10 × 5 paratha + ৳20 × 1 egg = ৳70 food, + ৳30 delivery = ৳100.
const form: FinalizeForm = {
	prices: { parata: '10', dim: '20' },
	totals: {},
	final: {
		[finalKey('u1', 'parata')]: 2,
		[finalKey('u2', 'parata')]: 3,
		[finalKey('u1', 'dim')]: 1,
		[finalKey('u3', 'murgi')]: 0
	},
	deliveryFee: '30',
	discount: '',
	payments: [{ userId: 'manager', amount: '100' }]
};

const run = (patch: Partial<FinalizeForm> = {}) => validateFinalize({ ...form, ...patch }, ctx);
const valid = (patch: Partial<FinalizeForm> = {}) => {
	const result = run(patch);
	if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
	return result.value;
};
const errorsOf = (patch: Partial<FinalizeForm>) => {
	const result = run(patch);
	if (result.ok) throw new Error('expected errors');
	return result;
};
const costOf = (v: ReturnType<typeof valid>, itemId: string) =>
	v.costs.find((c) => c.itemId === itemId)?.totalCost;

describe('validateFinalize: prices', () => {
	it('multiplies the per-piece price by the final quantity', () => {
		const v = valid();
		expect(costOf(v, 'parata')).toBe(5000);
		expect(costOf(v, 'dim')).toBe(2000);
		expect(v.itemsTotal).toBe(7000);
		expect(v.grandTotal).toBe(10000);
	});

	it('uses final quantities, not ordered ones, when the shop ran out', () => {
		// u2 got 2 paratha instead of 3: 4 × ৳10.
		const v = valid({
			final: { ...form.final, [finalKey('u2', 'parata')]: 2 },
			payments: [{ userId: 'manager', amount: '90' }]
		});
		expect(costOf(v, 'parata')).toBe(4000);
	});

	it('handles poisha prices exactly', () => {
		// ৳10.50 × 5 = ৳52.50.
		const v = valid({
			prices: { parata: '10.50', dim: '20' },
			payments: [{ userId: 'manager', amount: '102.50' }]
		});
		expect(costOf(v, 'parata')).toBe(5250);
	});

	it('uses the entered total for an item in total mode (two shops)', () => {
		// 5 paratha cost ৳53 in total across two shops.
		const v = valid({
			totals: { parata: '53' },
			payments: [{ userId: 'manager', amount: '103' }]
		});
		expect(costOf(v, 'parata')).toBe(5300);
	});

	it('requires a price for every item someone ate; 0 is allowed', () => {
		expect(errorsOf({ prices: { parata: '', dim: '20' } }).errors['price:parata']).toBe(
			'manage.finalize.error.priceRequired'
		);
		const free = valid({
			prices: { parata: '0', dim: '20' },
			payments: [{ userId: 'manager', amount: '50' }]
		});
		expect(costOf(free, 'parata')).toBe(0);
	});

	it('reports an unreadable price or total on its own field', () => {
		expect(errorsOf({ prices: { parata: 'abc', dim: '20' } }).errors['price:parata']).toBe(
			'manage.finalize.error.costInvalid'
		);
		expect(errorsOf({ totals: { parata: '-5' } }).errors['total:parata']).toBe(
			'manage.finalize.error.costInvalid'
		);
	});

	it('ignores inputs for items nobody got and costs them 0', () => {
		const v = valid({ prices: { parata: '10', dim: '20', murgi: '999' } });
		expect(costOf(v, 'murgi')).toBe(0);
	});
});

describe('validateFinalize: quantities', () => {
	it('defaults missing final quantities to quantity, or 0 when the item is unavailable', () => {
		const units = finalUnitsByItem({ ...form, final: {} }, ctx);
		expect(units.get('parata')).toBe(5);
		expect(units.get('murgi')).toBe(0);
	});

	it('rejects final quantities outside 0–20', () => {
		const r = errorsOf({ final: { ...form.final, [finalKey('u1', 'parata')]: 21 } });
		expect(r.errors[`final:${finalKey('u1', 'parata')}`]).toBe('manage.finalize.error.qtyInvalid');
	});
});

describe('validateFinalize: delivery fee and discount', () => {
	const nobodyAte = {
		[finalKey('u1', 'parata')]: 0,
		[finalKey('u2', 'parata')]: 0,
		[finalKey('u1', 'dim')]: 0,
		[finalKey('u3', 'murgi')]: 0
	};

	it('subtracts the discount from the total', () => {
		const v = valid({ discount: '20', payments: [{ userId: 'manager', amount: '80' }] });
		expect(v.discount).toBe(2000);
		expect(v.grandTotal).toBe(8000);
	});

	it('rejects a delivery fee or a discount when nobody ate', () => {
		expect(errorsOf({ final: nobodyAte }).errors.deliveryFee).toBe(
			'manage.finalize.error.feeNoEaters'
		);
		expect(errorsOf({ final: nobodyAte, deliveryFee: '', discount: '10' }).errors.discount).toBe(
			'manage.finalize.error.feeNoEaters'
		);
	});

	it("rejects a discount that would push someone's share below zero", () => {
		// u2's share is ৳30 food + ৳15 delivery = ৳45; a ৳100 discount gives each eater −৳50.
		const r = errorsOf({ discount: '100', payments: [{ userId: 'manager', amount: '0.01' }] });
		expect(r.errors.discount).toBe('manage.finalize.error.discountTooHigh');
	});

	it('treats an empty fee or discount as 0', () => {
		const v = valid({ deliveryFee: '', payments: [{ userId: 'manager', amount: '70' }] });
		expect(v.deliveryFee).toBe(0);
		expect(v.discount).toBe(0);
	});
});

describe('validateFinalize: payments', () => {
	it('requires a payment when the total is above 0', () => {
		expect(errorsOf({ payments: [] }).errors.payments).toBe(
			'manage.finalize.error.paymentsRequired'
		);
	});

	it('allows no payments when everyone skipped', () => {
		const v = valid({
			final: {
				[finalKey('u1', 'parata')]: 0,
				[finalKey('u2', 'parata')]: 0,
				[finalKey('u1', 'dim')]: 0,
				[finalKey('u3', 'murgi')]: 0
			},
			deliveryFee: '',
			payments: []
		});
		expect(v.grandTotal).toBe(0);
	});

	it('reports how much is missing or extra, to the poisha', () => {
		const short = errorsOf({ payments: [{ userId: 'manager', amount: '99.99' }] });
		expect(short.errors.payments).toBe('manage.finalize.error.paymentsShort');
		expect(short.mismatch).toBe(1);
		const over = errorsOf({ payments: [{ userId: 'manager', amount: '101' }] });
		expect(over.errors.payments).toBe('manage.finalize.error.paymentsOver');
		expect(over.mismatch).toBe(-100);
	});

	it('sums several payers', () => {
		const v = valid({
			payments: [
				{ userId: 'u1', amount: '60' },
				{ userId: 'u2', amount: '40' }
			]
		});
		expect(v.paidTotal).toBe(10000);
	});

	it('rejects unknown, duplicate and empty payer rows, and non-positive amounts', () => {
		expect(errorsOf({ payments: [{ userId: 'stranger', amount: '100' }] }).errors['payer:0']).toBe(
			'manage.finalize.error.payerNotAllowed'
		);
		expect(
			errorsOf({
				payments: [
					{ userId: 'u1', amount: '50' },
					{ userId: 'u1', amount: '50' }
				]
			}).errors['payer:1']
		).toBe('manage.finalize.error.payerDuplicate');
		expect(errorsOf({ payments: [{ userId: '', amount: '100' }] }).errors['payer:0']).toBe(
			'manage.finalize.error.payerRequired'
		);
		expect(errorsOf({ payments: [{ userId: 'u1', amount: '0' }] }).errors['paid:0']).toBe(
			'manage.finalize.error.paidInvalid'
		);
	});

	it('skips fully empty payment rows', () => {
		const v = valid({
			payments: [
				{ userId: 'manager', amount: '100' },
				{ userId: '', amount: '' }
			]
		});
		expect(v.payments).toHaveLength(1);
	});
});
