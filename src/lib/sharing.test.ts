import { describe, expect, it } from 'vitest';
import { openShares, shareHolders, topUpLeftovers } from '#lib/sharing.ts';

const l = (userId: string, itemId: string, quantity: number, at: number) => ({
	userId,
	itemId,
	quantity,
	at
});

describe('openShares', () => {
	it('reports the unclaimed part of each item', () => {
		const open = openShares([l('a', 'dal', 6, 1), l('b', 'dal', 6, 2), l('c', 'parata', 18, 3)]);
		expect(open.get('dal')).toBeUndefined();
		expect(open.get('parata')).toBe(6);
	});
});

describe('shareHolders', () => {
	it('lists who holds a half of an item with an open share, latest first', () => {
		const holders = shareHolders([
			l('a', 'dal', 6, 1),
			l('b', 'dal', 18, 5),
			l('c', 'dal', 12, 9),
			l('d', 'dal', 6, 3)
		]);
		// 6 + 18 + 12 + 6 = 42 twelfths = 3½: ½ open. c holds no half.
		expect(holders.get('dal')?.map((h) => h.userId)).toEqual(['b', 'd', 'a']);
	});

	it('leaves out items whose halves pair up', () => {
		expect(shareHolders([l('a', 'dal', 6, 1), l('b', 'dal', 6, 2)]).size).toBe(0);
	});
});

describe('topUpLeftovers', () => {
	it('makes the latest unmatched half a whole', () => {
		const out = topUpLeftovers([l('a', 'dal', 6, 1), l('b', 'dal', 6, 2), l('c', 'dal', 6, 3)]);
		expect(out.map((x) => x.quantity)).toEqual([6, 6, 12]);
	});

	it('tops up 1½ to 2 when that is the latest half', () => {
		const out = topUpLeftovers([l('a', 'dal', 6, 9), l('b', 'dal', 18, 4), l('c', 'dal', 6, 1)]);
		// 30 twelfths = 2½: a ordered last.
		expect(out.find((x) => x.userId === 'a')?.quantity).toBe(12);
		expect(out.find((x) => x.userId === 'b')?.quantity).toBe(18);
	});

	it('breaks a time tie by user id, so the result is stable', () => {
		const out = topUpLeftovers([l('b', 'dal', 6, 1), l('a', 'dal', 6, 1), l('c', 'dal', 6, 1)]);
		expect(out.find((x) => x.userId === 'c')?.quantity).toBe(12);
	});

	it('leaves matched items and whole orders alone', () => {
		const lines = [l('a', 'dal', 6, 1), l('b', 'dal', 6, 2), l('c', 'parata', 24, 3)];
		expect(topUpLeftovers(lines)).toEqual(lines);
	});
});
