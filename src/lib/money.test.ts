import { describe, expect, it } from 'vitest';
import { allocate, formatTaka, parseTaka, sum } from '#lib/money.ts';

describe('parseTaka', () => {
	it('parses plain, Bangla and formatted input', () => {
		expect(parseTaka('160')).toBe(16000);
		expect(parseTaka('১৬০')).toBe(16000);
		expect(parseTaka('1,250.50')).toBe(125050);
		expect(parseTaka('৳30')).toBe(3000);
		expect(parseTaka(' 12.5 ')).toBe(1250);
	});

	it('rejects junk, negatives and 3-decimal fractions', () => {
		expect(parseTaka('abc')).toBeNull();
		expect(parseTaka('-5')).toBeNull();
		expect(parseTaka('1.234')).toBeNull();
		expect(parseTaka('')).toBeNull();
	});
});

describe('formatTaka', () => {
	it('formats both locales and drops whole poisha', () => {
		expect(formatTaka(125050, 'bn')).toBe('৳১,২৫০.৫০');
		expect(formatTaka(125000, 'bn')).toBe('৳১,২৫০');
		expect(formatTaka(125050, 'en')).toBe('৳1,250.50');
		expect(formatTaka(-500, 'en')).toBe('−৳5');
	});
});

describe('sum', () => {
	it('adds poisha exactly', () => {
		expect(sum([100, 250, 1])).toBe(351);
		expect(sum([])).toBe(0);
	});
});

describe('allocate', () => {
	it('splits exactly and sums to the total', () => {
		expect(allocate(100, [1, 1])).toEqual([50, 50]);
		expect(allocate(1000, [3, 1])).toEqual([750, 250]);
	});

	it('puts leftover poisha on the largest fractional share', () => {
		// 101 across 3 equal weights: exact share 33.67 each.
		expect(allocate(101, [1, 1, 1])).toEqual([34, 34, 33]);
		expect(sum(allocate(101, [1, 1, 1]))).toBe(101);
	});

	it('breaks remainder ties by earlier index', () => {
		// 1 across 2 equal weights: tie, first index wins.
		expect(allocate(1, [1, 1])).toEqual([1, 0]);
	});

	it('keeps zero weights at zero', () => {
		expect(allocate(100, [0, 2])).toEqual([0, 100]);
		expect(allocate(0, [0, 0])).toEqual([0, 0]);
	});

	it('adds up exactly for awkward totals', () => {
		for (const total of [1, 7, 99, 12345]) {
			for (const weights of [[1], [2, 3], [1, 1, 1], [7, 0, 13]]) {
				expect(sum(allocate(total, weights))).toBe(total);
			}
		}
	});

	it('throws when a positive total has no units', () => {
		expect(() => allocate(100, [0, 0])).toThrow('zero units');
		expect(() => allocate(-1, [1])).toThrow();
		expect(() => allocate(1.5, [1])).toThrow();
	});
});
