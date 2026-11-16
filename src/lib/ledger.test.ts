import { describe, expect, it } from 'vitest';
import {
	applyPending,
	balancesFrom,
	groupHistory,
	pairwiseSettlements,
	canDecideSettlement,
	canRecordSettlement,
	canVoidSettlement,
	initialSettlementStatus,
	validateRejectReason,
	validateSettlementInput,
	type LedgerInput,
	type SettlementStatus
} from '#lib/ledger.ts';

/**
 * Hand-worked example (poisha):
 *
 * Day 1 (finalized): paratha ৳300 over 3 units, dim ৳100 over 2, delivery ৳50 over 2 eaters.
 *   u1 (2 paratha + 1 dim): 20000 + 5000 + 2500 = 27500
 *   u2 (1 paratha + 1 dim): 10000 + 5000 + 2500 = 17500
 *   Payments on day 1: u1 ৳250, u3 ৳200 (two payers).
 * Day 2 (finalized): cha ৳90 over 3 units, all u2. Payment: u2 ৳90.
 * Day 3 (reopened): items, lines and a payment exist but must all be ignored.
 * Settlement: u1 paid u2 ৳100. A second, voided settlement must be ignored.
 *
 * u1: −27500 + 25000 + 10000 = +7500
 * u2: −17500 − 9000 + 9000 − 10000 = −27500
 * u3: +20000
 */
const input: LedgerInput = {
	days: [
		{ id: 'd1', date: '2026-11-02', deliveryFee: 5000 },
		{ id: 'd2', date: '2026-11-03', deliveryFee: 0 }
	],
	items: [
		{ dayId: 'd1', itemId: 'parata', totalCost: 30000 },
		{ dayId: 'd1', itemId: 'dim', totalCost: 10000 },
		{ dayId: 'd2', itemId: 'cha', totalCost: 9000 },
		{ dayId: 'd3', itemId: 'roshogolla', totalCost: 12000 }
	],
	lines: [
		{ dayId: 'd1', userId: 'u1', itemId: 'parata', finalQuantity: 2 },
		{ dayId: 'd1', userId: 'u2', itemId: 'parata', finalQuantity: 1 },
		{ dayId: 'd1', userId: 'u1', itemId: 'dim', finalQuantity: 1 },
		{ dayId: 'd1', userId: 'u2', itemId: 'dim', finalQuantity: 1 },
		{ dayId: 'd2', userId: 'u2', itemId: 'cha', finalQuantity: 3 },
		{ dayId: 'd3', userId: 'u3', itemId: 'roshogolla', finalQuantity: 1 }
	],
	payments: [
		{ dayId: 'd1', userId: 'u1', amount: 25000 },
		{ dayId: 'd1', userId: 'u3', amount: 20000 },
		{ dayId: 'd2', userId: 'u2', amount: 9000 },
		{ dayId: 'd3', userId: 'u3', amount: 12000 }
	],
	settlements: [
		{
			id: 's1',
			fromUserId: 'u1',
			toUserId: 'u2',
			amount: 10000,
			voidedAt: null,
			status: 'approved'
		},
		{
			id: 's2',
			fromUserId: 'u2',
			toUserId: 'u3',
			amount: 5000,
			voidedAt: new Date(),
			status: 'approved'
		}
	]
};

describe('balancesFrom', () => {
	it('computes the hand-worked example exactly', () => {
		const balances = balancesFrom(input);
		expect(balances.get('u1')).toBe(7500);
		expect(balances.get('u2')).toBe(-27500);
		expect(balances.get('u3')).toBe(20000);
	});

	it('sums to exactly 0 poisha', () => {
		const total = [...balancesFrom(input).values()].reduce((a, b) => a + b, 0);
		expect(total).toBe(0);
	});

	it('gives 0 to someone who never ate and never paid', () => {
		const balances = balancesFrom(input);
		expect(balances.get('u4') ?? 0).toBe(0);
	});

	it('keeps a user with an explicitly zero balance in the map', () => {
		// A ৳175 settlement squares u2 away exactly; they still appear, as settled.
		const balances = balancesFrom({
			...input,
			settlements: [
				{
					id: 's1',
					fromUserId: 'u2',
					toUserId: 'u1',
					amount: 17500,
					voidedAt: null,
					status: 'approved'
				}
			]
		});
		// u2 pays u1 back ৳175 exactly: u2 lands on 0 and stays in the map, u1 drops to −20000.
		expect(balances.get('u1')).toBe(-20000);
		expect(balances.get('u2')).toBe(0);
	});
});

describe('pairwiseSettlements', () => {
	const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

	it('has each person pay the people they actually owe', () => {
		// d1: u1 owes u3 ৳25 and u2 owes u3 ৳175 (u3 paid more than they ate); u1's ৳100 to
		// u2 was an overpayment, so u2 owes it back.
		expect(pairwiseSettlements(input)).toEqual([
			{
				from: 'u2',
				to: 'u3',
				amount: 17500,
				days: [{ dayId: 'd1', date: '2026-11-02', amount: 17500, dayNet: 17500 }]
			},
			{ from: 'u2', to: 'u1', amount: 10000, days: [] },
			{
				from: 'u1',
				to: 'u3',
				amount: 2500,
				days: [{ dayId: 'd1', date: '2026-11-02', amount: 2500, dayNet: 2500 }]
			}
		]);
	});

	it('does not route a debt through a third person', () => {
		// Real case: e owes r for a breakfast; r owes s back an overpayment. Pooled
		// balances would have e pay s. Person to person, e pays r and r refunds s.
		const run: LedgerInput = {
			days: [{ id: 'a', date: '2026-11-16', deliveryFee: 0 }],
			items: [{ dayId: 'a', itemId: 'x', totalCost: 5133 }],
			lines: [{ dayId: 'a', userId: 'e', itemId: 'x', finalQuantity: 12 }],
			payments: [{ dayId: 'a', userId: 'r', amount: 5133 }],
			settlements: [
				{
					id: 's',
					fromUserId: 's',
					toUserId: 'r',
					amount: 5000,
					voidedAt: null,
					status: 'approved'
				}
			]
		};
		expect(pairwiseSettlements(run)).toEqual([
			{
				from: 'e',
				to: 'r',
				amount: 5133,
				days: [{ dayId: 'a', date: '2026-11-16', amount: 5133, dayNet: 5133 }]
			},
			{ from: 'r', to: 's', amount: 5000, days: [] }
		]);
	});

	it('takes older days as paid first, the oldest open one in part', () => {
		const days = [
			{ id: 'a', date: '2026-11-01', deliveryFee: 0 },
			{ id: 'b', date: '2026-11-02', deliveryFee: 0 },
			{ id: 'c', date: '2026-11-03', deliveryFee: 0 }
		];
		const run: LedgerInput = {
			days,
			items: days.map((d) => ({ dayId: d.id, itemId: 'x', totalCost: 6000 })),
			lines: days.map((d) => ({ dayId: d.id, userId: 'eater', itemId: 'x', finalQuantity: 12 })),
			payments: days.map((d) => ({ dayId: d.id, userId: 'payer', amount: 6000 })),
			settlements: [
				{
					id: 's',
					fromUserId: 'eater',
					toUserId: 'payer',
					amount: 8000,
					voidedAt: null,
					status: 'approved'
				}
			]
		};
		expect(pairwiseSettlements(run)).toEqual([
			{
				from: 'eater',
				to: 'payer',
				amount: 10000,
				days: [
					{ dayId: 'c', date: '2026-11-03', amount: 6000, dayNet: 6000 },
					{ dayId: 'b', date: '2026-11-02', amount: 4000, dayNet: 6000 }
				]
			}
		]);
	});

	it('cancels debts both ways between the same two people', () => {
		const days = [
			{ id: 'a', date: '2026-11-01', deliveryFee: 0 },
			{ id: 'b', date: '2026-11-02', deliveryFee: 0 }
		];
		const run: LedgerInput = {
			days,
			items: days.map((d) => ({ dayId: d.id, itemId: 'x', totalCost: d.id === 'a' ? 5000 : 3000 })),
			lines: [
				{ dayId: 'a', userId: 'p', itemId: 'x', finalQuantity: 12 },
				{ dayId: 'b', userId: 'q', itemId: 'x', finalQuantity: 12 }
			],
			payments: [
				{ dayId: 'a', userId: 'q', amount: 5000 },
				{ dayId: 'b', userId: 'p', amount: 3000 }
			],
			settlements: []
		};
		expect(pairwiseSettlements(run)).toEqual([
			{
				from: 'p',
				to: 'q',
				amount: 2000,
				days: [{ dayId: 'a', date: '2026-11-01', amount: 2000, dayNet: 5000 }]
			}
		]);
	});

	it('ignores pending, rejected and voided settlements', () => {
		const run: LedgerInput = {
			...input,
			settlements: [
				{
					id: 'p',
					fromUserId: 'u2',
					toUserId: 'u3',
					amount: 17500,
					voidedAt: null,
					status: 'pending'
				},
				{
					id: 'r',
					fromUserId: 'u2',
					toUserId: 'u3',
					amount: 17500,
					voidedAt: null,
					status: 'rejected'
				},
				{
					id: 'v',
					fromUserId: 'u2',
					toUserId: 'u3',
					amount: 17500,
					voidedAt: new Date(),
					status: 'approved'
				}
			]
		};
		expect(pairwiseSettlements(run).find((t) => t.from === 'u2')?.amount).toBe(17500);
	});

	it('adds up to every balance and never pays a day twice (fuzz)', () => {
		const random = mulberry32(20261116);
		const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
		for (let round = 0; round < 200; round++) {
			const users = Array.from({ length: 2 + Math.floor(random() * 6) }, (_, i) => `u${i}`);
			const days = Array.from({ length: 1 + Math.floor(random() * 5) }, (_, i) => ({
				id: `d${i}`,
				date: `2026-11-${String(i + 1).padStart(2, '0')}`,
				deliveryFee: Math.floor(random() * 1000)
			}));
			const run: LedgerInput = { days, items: [], lines: [], payments: [], settlements: [] };
			for (const d of days) {
				const cost = 1000 + Math.floor(random() * 50_000);
				run.items.push({ dayId: d.id, itemId: 'x', totalCost: cost });
				const eaters = users.filter(() => random() < 0.6);
				if (eaters.length === 0) eaters.push(users[0]);
				for (const u of eaters)
					run.lines.push({
						dayId: d.id,
						userId: u,
						itemId: 'x',
						finalQuantity: 6 * (1 + Math.floor(random() * 3))
					});
				// One or two payers covering the bill exactly.
				const bill = cost + d.deliveryFee;
				const first = pick(users);
				const split = random() < 0.5 ? Math.floor(random() * bill) : 0;
				run.payments.push({ dayId: d.id, userId: first, amount: bill - split });
				if (split > 0) run.payments.push({ dayId: d.id, userId: pick(users), amount: split });
			}
			for (let i = Math.floor(random() * 4); i > 0; i--) {
				const from = pick(users);
				const to = pick(users.filter((u) => u !== from));
				run.settlements.push({
					id: `s${i}`,
					fromUserId: from,
					toUserId: to,
					amount: 1 + Math.floor(random() * 20_000),
					voidedAt: null,
					status: 'approved'
				});
			}

			const balances = balancesFrom(run);
			const plan = pairwiseSettlements(run);
			const settled = new Map(balances);
			const pairs = new Set<string>();
			for (const t of plan) {
				expect(t.amount).toBeGreaterThan(0);
				expect(t.from).not.toBe(t.to);
				const pair = [t.from, t.to].sort().join('|');
				expect(pairs.has(pair)).toBe(false);
				pairs.add(pair);
				expect(sum(t.days.map((d) => d.amount))).toBeLessThanOrEqual(t.amount);
				for (const d of t.days) expect(d.amount).toBeLessThanOrEqual(d.dayNet);
				settled.set(t.from, settled.get(t.from)! + t.amount);
				settled.set(t.to, settled.get(t.to)! - t.amount);
			}
			for (const v of settled.values()) expect(v).toBe(0);
		}
	});
});

describe('permission rules', () => {
	it('lets a party record, blocks outsiders, allows managers', () => {
		expect(canRecordSettlement('u1', false, 'u1', 'u2')).toBe(true);
		expect(canRecordSettlement('u2', false, 'u1', 'u2')).toBe(true);
		expect(canRecordSettlement('u3', false, 'u1', 'u2')).toBe(false);
		expect(canRecordSettlement('boss', true, 'u1', 'u2')).toBe(true);
	});

	it('lets the creator or a manager void, blocks others', () => {
		expect(canVoidSettlement('u1', false, 'u1', 'approved')).toBe(true);
		expect(canVoidSettlement('u2', false, 'u1', 'approved')).toBe(false);
		expect(canVoidSettlement('boss', true, 'u1', 'approved')).toBe(true);
	});
});

describe('settlement status rules', () => {
	it('starts approved only when the receiver logs it', () => {
		expect(initialSettlementStatus('a', 'a')).toBe('approved');
		expect(initialSettlementStatus('b', 'a')).toBe('pending');
		expect(initialSettlementStatus('m', 'a')).toBe('pending');
	});

	it('lets only the receiver decide a pending, non-voided row', () => {
		const row = { toUserId: 'a', status: 'pending' as SettlementStatus, voidedAt: null };
		expect(canDecideSettlement('a', row)).toBe(true);
		expect(canDecideSettlement('b', row)).toBe(false);
		expect(canDecideSettlement('m', row)).toBe(false);
		expect(canDecideSettlement('a', { ...row, status: 'approved' })).toBe(false);
		expect(canDecideSettlement('a', { ...row, status: 'rejected' })).toBe(false);
		expect(canDecideSettlement('a', { ...row, voidedAt: new Date() })).toBe(false);
	});

	it('refuses to void rejected rows, allows cancelling a pending one', () => {
		expect(canVoidSettlement('b', false, 'b', 'rejected')).toBe(false);
		expect(canVoidSettlement('m', true, 'b', 'rejected')).toBe(false);
		expect(canVoidSettlement('b', false, 'b', 'pending')).toBe(true);
	});

	it('never counts a pending or rejected settlement toward balances', () => {
		const base = balancesFrom(input);
		const withExtra = balancesFrom({
			...input,
			settlements: [
				...input.settlements,
				{
					id: 's3',
					fromUserId: 'u1',
					toUserId: 'u2',
					amount: 10000,
					voidedAt: null,
					status: 'pending'
				},
				{
					id: 's4',
					fromUserId: 'u1',
					toUserId: 'u2',
					amount: 5000,
					voidedAt: null,
					status: 'rejected'
				}
			]
		});
		expect(withExtra).toEqual(base);
	});
});

describe('validateRejectReason', () => {
	it('trims, empties to null, and refuses more than 100 characters', () => {
		expect(validateRejectReason('  ')).toEqual({ ok: true, value: null });
		expect(validateRejectReason(' পাইনি ')).toEqual({ ok: true, value: 'পাইনি' });
		expect(validateRejectReason('x'.repeat(101))).toEqual({
			ok: false,
			error: 'ledger.error.reasonLong'
		});
		expect(validateRejectReason('x'.repeat(100))).toEqual({ ok: true, value: 'x'.repeat(100) });
	});
});

describe('validateSettlementInput', () => {
	const base = { from: 'u1', to: 'u2', amount: '85.50', note: '  bKash  ', date: '' };

	it('accepts a valid form and normalizes it', () => {
		const r = validateSettlementInput(base, { today: '2026-11-04' });
		expect(r.ok).toBe(true);
		if (r.ok)
			expect(r.value).toEqual({
				fromUserId: 'u1',
				toUserId: 'u2',
				amount: 8550,
				note: 'bKash',
				date: '2026-11-04'
			});
	});

	it('accepts Bangla digits and an explicit date', () => {
		const r = validateSettlementInput(
			{ ...base, amount: '৮৫', date: '2026-11-01' },
			{ today: '2026-11-04' }
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value.amount).toBe(8500);
			expect(r.value.date).toBe('2026-11-01');
		}
	});

	it('requires both parties', () => {
		const r = validateSettlementInput({ ...base, from: '', to: '' }, { today: '2026-11-04' });
		expect(!r.ok && r.errors.from).toBe('ledger.error.pickMember');
		expect(!r.ok && r.errors.to).toBe('ledger.error.pickMember');
	});

	it('rejects from === to', () => {
		const r = validateSettlementInput({ ...base, to: 'u1' }, { today: '2026-11-04' });
		expect(!r.ok && r.errors.to).toBe('ledger.error.self');
	});

	it('requires a positive, parseable amount', () => {
		for (const amount of ['', 'abc', '0', '-5']) {
			const r = validateSettlementInput({ ...base, amount }, { today: '2026-11-04' });
			expect(!r.ok && r.errors.amount, amount).toBe('ledger.error.amount');
		}
	});

	it('caps the note at 100 characters', () => {
		const ok = validateSettlementInput({ ...base, note: 'x'.repeat(100) }, { today: '2026-11-04' });
		expect(ok.ok).toBe(true);
		const long = validateSettlementInput(
			{ ...base, note: 'x'.repeat(101) },
			{ today: '2026-11-04' }
		);
		expect(!long.ok && long.errors.note).toBe('ledger.error.note');
	});

	it('rejects future, malformed and impossible dates', () => {
		for (const date of ['2026-11-05', '9999-01-01', '2026-2-5', '2026-02-31', 'yesterday']) {
			const r = validateSettlementInput({ ...base, date }, { today: '2026-11-04' });
			expect(!r.ok && r.errors.date, date).toBe('ledger.error.date');
		}
	});
});

/** Deterministic PRNG so the fuzz loop is reproducible. */
function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe('groupHistory', () => {
	const row = (
		id: string,
		date: string,
		fromId: string,
		toId: string,
		amount: number,
		status: 'pending' | 'approved' | 'rejected' = 'approved',
		voidedAt: Date | null = null
	) => ({ id, date, fromId, toId, amount, status, voidedAt });

	it('groups my settlements by month, newest first', () => {
		const months = groupHistory(
			[
				row('a', '2026-10-30', 'me', 'x', 1000),
				row('b', '2026-11-05', 'me', 'x', 5000),
				row('c', '2026-11-04', 'y', 'me', 12000)
			],
			'me'
		);
		expect(months.map((m) => m.month)).toEqual(['2026-11', '2026-10']);
		expect(months[0].entries.map((e) => e.id)).toEqual(['b', 'c']);
		expect(months[0].entries.map((e) => e.direction)).toEqual(['out', 'in']);
	});

	it('totals only approved, unvoided entries', () => {
		const [nov] = groupHistory(
			[
				row('a', '2026-11-05', 'me', 'x', 5000),
				row('b', '2026-11-05', 'me', 'x', 700, 'pending'),
				row('c', '2026-11-04', 'y', 'me', 12000),
				row('d', '2026-11-03', 'me', 'z', 3000, 'rejected'),
				row('e', '2026-11-02', 'y', 'me', 900, 'approved', new Date())
			],
			'me'
		);
		expect(nov.paid).toBe(5000);
		expect(nov.received).toBe(12000);
		expect(nov.entries.map((e) => e.counts)).toEqual([true, false, true, false, false]);
	});

	it('leaves out rows I am not part of', () => {
		expect(groupHistory([row('a', '2026-11-05', 'x', 'y', 100)], 'me')).toEqual([]);
	});
});

describe('applyPending', () => {
	const t = (to: string, amount: number) => ({ from: 'me', to, amount });

	it('takes my pending payments off each suggestion', () => {
		const out = applyPending([t('rafi', 3100), t('sumi', 10000)], { rafi: 3100, sumi: 3100 });
		expect(out).toEqual([
			{ from: 'me', to: 'rafi', amount: 3100, remaining: 0, pending: 3100 },
			{ from: 'me', to: 'sumi', amount: 10000, remaining: 6900, pending: 3100 }
		]);
	});

	it('never goes below zero when more is pending than suggested', () => {
		const [row] = applyPending([t('rafi', 3100)], { rafi: 5000 });
		expect(row.remaining).toBe(0);
		expect(row.pending).toBe(3100);
	});

	it('leaves suggestions with nothing pending unchanged', () => {
		const [row] = applyPending([t('rafi', 3100)], {});
		expect(row).toMatchObject({ remaining: 3100, pending: 0 });
	});
});

describe('groupHistory: pending totals', () => {
	it('adds up pending, unvoided entries separately from the approved totals', () => {
		const r = (
			id: string,
			fromId: string,
			toId: string,
			amount: number,
			status: 'pending' | 'approved',
			voidedAt: Date | null = null
		) => ({ id, date: '2026-11-05', fromId, toId, amount, status, voidedAt });
		const [nov] = groupHistory(
			[
				r('a', 'me', 'rafi', 3100, 'pending'),
				r('b', 'sumi', 'me', 2000, 'pending'),
				r('c', 'me', 'rafi', 900, 'pending', new Date()),
				r('d', 'me', 'rafi', 5000, 'approved')
			],
			'me'
		);
		expect(nov.pendingPaid).toBe(3100);
		expect(nov.pendingReceived).toBe(2000);
		expect(nov.paid).toBe(5000);
	});
});
