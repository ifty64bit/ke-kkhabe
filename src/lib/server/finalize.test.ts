import { describe, expect, it } from 'vitest';
import {
	finalKey,
	finalUnitsByItem,
	validateFinalize,
	type FinalizeContext,
	type FinalizeForm
} from '#lib/server/finalize.ts';
import { computeCharges } from '#lib/charges.ts';

// Paratha: u1 ×2, u2 ×3 (5 pcs). Egg: u1 ×1. Chicken is unavailable, so u3's line defaults to 0.
const ctx: FinalizeContext = {
	items: [
		{ id: 'parata', available: true },
		{ id: 'dim', available: true },
		{ id: 'murgi', available: false }
	],
	lines: [
		{ userId: 'u1', itemId: 'parata', quantity: 24 },
		{ userId: 'u2', itemId: 'parata', quantity: 36 },
		{ userId: 'u1', itemId: 'dim', quantity: 12 },
		{ userId: 'u3', itemId: 'murgi', quantity: 12 }
	],
	payerIds: new Set(['u1', 'u2', 'manager'])
};

// ৳10 × 5 paratha + ৳20 × 1 egg = ৳70 food, + ৳30 delivery = ৳100.
const form: FinalizeForm = {
	prices: { parata: '10', dim: '20' },
	final: {
		[finalKey('u1', 'parata')]: 24,
		[finalKey('u2', 'parata')]: 36,
		[finalKey('u1', 'dim')]: 12,
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
			final: { ...form.final, [finalKey('u2', 'parata')]: 24 },
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

	it('reports an unreadable or negative price on its own field', () => {
		expect(errorsOf({ prices: { parata: 'abc', dim: '20' } }).errors['price:parata']).toBe(
			'manage.finalize.error.costInvalid'
		);
		expect(errorsOf({ prices: { parata: '-5', dim: '20' } }).errors['price:parata']).toBe(
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
		expect(units.get('parata')).toBe(60);
		expect(units.get('murgi')).toBe(0);
	});

	it('rejects final quantities above 20 items', () => {
		const r = errorsOf({ final: { ...form.final, [finalKey('u1', 'parata')]: 252 } });
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

describe('validateFinalize: shared items (fractions)', () => {
	it('charges whole items bought and shares the leftover', () => {
		// Two people order ½ dal and one orders ⅓: 1⅓ ordered, 2 bought at ৳30.
		const dalCtx: FinalizeContext = {
			items: [{ id: 'dal', available: true }],
			lines: [
				{ userId: 'u1', itemId: 'dal', quantity: 6 },
				{ userId: 'u2', itemId: 'dal', quantity: 6 },
				{ userId: 'u3', itemId: 'dal', quantity: 4 }
			],
			payerIds: new Set(['manager'])
		};
		const result = validateFinalize(
			{
				prices: { dal: '30' },
				final: {},
				deliveryFee: '',
				discount: '',
				payments: [{ userId: 'manager', amount: '60' }]
			},
			dalCtx
		);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(costOf(result.value, 'dal')).toBe(6000);
		const charges = computeCharges(
			result.value.costs,
			result.value.final.map((f) => ({ ...f, finalQuantity: f.quantity })),
			0
		);
		// ৳60 over 16 twelfths: ½ → ৳22.50, ⅓ → ৳15.
		expect(charges.get('u1')).toBe(2250);
		expect(charges.get('u2')).toBe(2250);
		expect(charges.get('u3')).toBe(1500);
	});

	it('a fraction-only eater shares the delivery fee', () => {
		const mixed: FinalizeContext = {
			items: [
				{ id: 'parata', available: true },
				{ id: 'dal', available: true }
			],
			lines: [
				{ userId: 'u1', itemId: 'parata', quantity: 24 },
				{ userId: 'u2', itemId: 'dal', quantity: 6 }
			],
			payerIds: new Set(['manager'])
		};
		const result = validateFinalize(
			{
				prices: { parata: '10', dal: '30' },
				final: {},
				deliveryFee: '20',
				discount: '',
				payments: [{ userId: 'manager', amount: '70' }]
			},
			mixed
		);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		const charges = computeCharges(
			result.value.costs,
			result.value.final.map((f) => ({ ...f, finalQuantity: f.quantity })),
			result.value.deliveryFee
		);
		expect(charges.get('u1')).toBe(2000 + 1000);
		expect(charges.get('u2')).toBe(3000 + 1000);
	});

	it('rejects quantities that are not an allowed fraction', () => {
		const key = finalKey('u1', 'parata');
		for (const bad of [5, 241]) {
			const r = errorsOf({ final: { ...form.final, [key]: bad } });
			expect(r.errors[`final:${key}`]).toBe('manage.finalize.error.qtyInvalid');
		}
	});
});
