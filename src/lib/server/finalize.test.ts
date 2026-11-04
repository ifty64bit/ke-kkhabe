import { describe, expect, it } from 'vitest';
import {
	finalKey,
	finalUnitsByItem,
	validateFinalize,
	type FinalizeContext,
	type FinalizeForm
} from '#lib/server/finalize.ts';

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

const form: FinalizeForm = {
	costs: { parata: '160', dim: '60', murgi: '' },
	final: {
		[finalKey('u1', 'parata')]: 2,
		[finalKey('u2', 'parata')]: 3,
		[finalKey('u1', 'dim')]: 1,
		[finalKey('u3', 'murgi')]: 1
	},
	deliveryFee: '30',
	payments: [{ userId: 'manager', amount: '250' }]
};

const valid = () => {
	const result = validateFinalize(form, ctx);
	if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
	return result.value;
};

describe('validateFinalize', () => {
	it('accepts a valid form and returns parsed values and totals', () => {
		const v = valid();
		expect(v.itemsTotal).toBe(22000);
		expect(v.deliveryFee).toBe(3000);
		expect(v.grandTotal).toBe(25000);
		expect(v.paidTotal).toBe(25000);
		expect(v.payments).toEqual([{ userId: 'manager', amount: 25000 }]);
		expect(v.final.find((f) => f.userId === 'u3')?.quantity).toBe(1);
	});

	it('treats an empty cost or fee as 0', () => {
		const r = validateFinalize(
			{
				...form,
				costs: { ...form.costs, parata: '', dim: '' },
				deliveryFee: '',
				payments: [{ userId: 'manager', amount: '1' }]
			},
			ctx
		);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors['payments']).toBe('manage.finalize.error.paymentsOver');
			expect(r.mismatch).toBe(-100);
		}
	});

	it('rejects an unparseable cost on that item’s field', () => {
		const r = validateFinalize({ ...form, costs: { ...form.costs, dim: 'abc' } }, ctx);
		expect(!r.ok && r.errors['cost:dim']).toBe('manage.finalize.error.costInvalid');
	});

	it('rejects a cost on an item nobody got', () => {
		const r = validateFinalize(
			{
				...form,
				costs: { ...form.costs, parata: '160' },
				final: { ...form.final, [finalKey('u1', 'parata')]: 0, [finalKey('u2', 'parata')]: 0 }
			},
			ctx
		);
		expect(!r.ok && r.errors['cost:parata']).toBe('manage.finalize.error.zeroUnitsCost');
	});

	it('defaults missing final quantities to quantity, or 0 when the item is unavailable', () => {
		const submitted: FinalizeForm = { ...form, final: {} };
		expect(finalUnitsByItem(submitted, ctx).get('parata')).toBe(5);
		expect(finalUnitsByItem(submitted, ctx).get('dim')).toBe(1);
		expect(finalUnitsByItem(submitted, ctx).get('murgi')).toBe(0);
	});

	it('rejects final quantities outside 0–20', () => {
		const r = validateFinalize(
			{ ...form, final: { ...form.final, [finalKey('u1', 'parata')]: 21 } },
			ctx
		);
		expect(!r.ok && r.errors[`final:${finalKey('u1', 'parata')}`]).toBe(
			'manage.finalize.error.qtyInvalid'
		);
	});

	it('rejects a delivery fee when nobody ate', () => {
		const r = validateFinalize(
			{
				...form,
				final: Object.fromEntries(Object.entries(form.final).map(([k]) => [k, 0])),
				deliveryFee: '30'
			},
			ctx
		);
		expect(!r.ok && r.errors['deliveryFee']).toBe('manage.finalize.error.feeNoEaters');
	});

	it('requires a payment when the grand total is above 0', () => {
		const r = validateFinalize({ ...form, payments: [] }, ctx);
		expect(!r.ok && r.errors['payments']).toBe('manage.finalize.error.paymentsRequired');
		expect(!r.ok && r.mismatch).toBe(25000);
	});

	it('allows zero costs with no payments when everyone skipped', () => {
		const r = validateFinalize(
			{
				costs: { parata: '', dim: '', murgi: '' },
				final: {},
				deliveryFee: '',
				payments: []
			},
			ctx
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value.grandTotal).toBe(0);
			expect(r.value.payments).toEqual([]);
		}
	});

	it('reports how much is missing, to the poisha', () => {
		const r = validateFinalize(
			{ ...form, payments: [{ userId: 'manager', amount: '249.97' }] },
			ctx
		);
		expect(!r.ok && r.errors['payments']).toBe('manage.finalize.error.paymentsShort');
		expect(!r.ok && r.mismatch).toBe(3);
	});

	it('reports when payments overshoot', () => {
		const r = validateFinalize({ ...form, payments: [{ userId: 'manager', amount: '251' }] }, ctx);
		expect(!r.ok && r.errors['payments']).toBe('manage.finalize.error.paymentsOver');
		expect(!r.ok && r.mismatch).toBe(-100);
	});

	it('sums several payers before comparing', () => {
		const v = validateFinalize(
			{
				...form,
				payments: [
					{ userId: 'u1', amount: '200' },
					{ userId: 'u2', amount: '50' }
				]
			},
			ctx
		);
		expect(v.ok).toBe(true);
		if (v.ok) expect(v.value.paidTotal).toBe(25000);
	});

	it('rejects a payer who is inactive and not already a payer', () => {
		const closedCtx = { ...ctx, payerIds: new Set(['u1', 'u2', 'manager']) };
		const r = validateFinalize(
			{ ...form, payments: [{ userId: 'ghost', amount: '253' }] },
			closedCtx
		);
		expect(!r.ok && r.errors['payer:0']).toBe('manage.finalize.error.payerNotAllowed');
	});

	it('rejects duplicate payers', () => {
		const r = validateFinalize(
			{
				...form,
				payments: [
					{ userId: 'u1', amount: '100' },
					{ userId: 'u1', amount: '150' }
				]
			},
			ctx
		);
		expect(!r.ok && r.errors['payer:1']).toBe('manage.finalize.error.payerDuplicate');
	});

	it('rejects a payment row without a payer or with a non-positive amount', () => {
		const r = validateFinalize(
			{
				...form,
				payments: [
					{ userId: '', amount: '100' },
					{ userId: 'u1', amount: '0' },
					{ userId: 'u2', amount: '' },
					{ userId: 'manager', amount: '250' }
				]
			},
			ctx
		);
		expect(!r.ok && r.errors['payer:0']).toBe('manage.finalize.error.payerRequired');
		expect(!r.ok && r.errors['paid:1']).toBe('manage.finalize.error.paidInvalid');
		expect(!r.ok && r.errors['paid:2']).toBe('manage.finalize.error.paidInvalid');
	});

	it('skips fully empty payment rows', () => {
		const v = validateFinalize(
			{
				...form,
				payments: [
					{ userId: '', amount: '' },
					{ userId: 'manager', amount: '250' }
				]
			},
			ctx
		);
		expect(v.ok).toBe(true);
		if (v.ok) expect(v.value.payments).toEqual([{ userId: 'manager', amount: 25000 }]);
	});
});
