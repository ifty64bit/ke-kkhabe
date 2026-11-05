import { describe, expect, it } from 'vitest';
import {
	canSetFraction,
	includesLeftover,
	formatQty,
	isValidQty,
	join,
	leftover,
	MAX_UNITS,
	pricePerPiece,
	setFraction,
	split,
	stepWhole,
	toBuy
} from '#lib/quantity.ts';

describe('isValidQty', () => {
	it('accepts wholes and the allowed fractions up to 20 items', () => {
		for (const n of [0, 6, 12, 18, 240]) expect(isValidQty(n)).toBe(true);
	});

	it('rejects other twelfths, out-of-range and non-integers', () => {
		for (const n of [5, 7, 13, 241, 246, -6, 1.5, NaN]) expect(isValidQty(n)).toBe(false);
	});

	it('only allows halves for now (¼, ⅓, ⅔, ¾ are disabled)', () => {
		for (const n of [3, 4, 8, 9, 16]) expect(isValidQty(n)).toBe(false);
	});
});

describe('split / join', () => {
	it('splits into whole and fraction', () => {
		expect(split(16)).toEqual({ whole: 1, fraction: 4 });
		expect(join(1, 4)).toBe(16);
	});

	it('round-trips every valid value', () => {
		for (let n = 0; n <= MAX_UNITS; n++) {
			if (!isValidQty(n)) continue;
			const { whole, fraction } = split(n);
			expect(join(whole, fraction)).toBe(n);
		}
	});
});

describe('toBuy / leftover', () => {
	it('rounds up to whole items', () => {
		expect(toBuy(0)).toBe(0);
		expect(toBuy(4)).toBe(1);
		expect(toBuy(12)).toBe(1);
		expect(toBuy(28)).toBe(3);
		expect(toBuy(36)).toBe(3);
	});

	it('reports the unclaimed part', () => {
		expect(leftover(28)).toBe(8);
		expect(leftover(36)).toBe(0);
		expect(leftover(0)).toBe(0);
	});
});

describe('pricePerPiece', () => {
	it('divides the total cost by whole items bought', () => {
		expect(pricePerPiece(9000, 28)).toBe(3000);
		expect(pricePerPiece(5000, 60)).toBe(1000);
		expect(pricePerPiece(100, 0)).toBe(0);
	});
});

describe('stepper math', () => {
	it('steps the whole part and keeps the fraction', () => {
		expect(stepWhole(18, -1)).toBe(6);
		expect(stepWhole(6, -1)).toBe(0);
		expect(stepWhole(240, 1)).toBe(240);
		expect(stepWhole(234, 1)).toBe(240);
		expect(stepWhole(0, 1)).toBe(12);
	});

	it('sets the fraction without passing the maximum', () => {
		expect(setFraction(12, 6)).toBe(18);
		expect(setFraction(18, 0)).toBe(12);
		expect(setFraction(240, 6)).toBe(240);
		expect(canSetFraction(240, 6)).toBe(false);
		expect(canSetFraction(228, 6)).toBe(true);
	});
});

describe('formatQty', () => {
	it('formats in English', () => {
		expect(formatQty(16, 'en')).toBe('1⅓');
		expect(formatQty(6, 'en')).toBe('½');
		expect(formatQty(24, 'en')).toBe('2');
		expect(formatQty(0, 'en')).toBe('0');
		expect(formatQty(150, 'en')).toBe('12½');
	});

	it('formats in Bangla digits', () => {
		expect(formatQty(16, 'bn')).toBe('১⅓');
		expect(formatQty(6, 'bn')).toBe('½');
		expect(formatQty(24, 'bn')).toBe('২');
	});

	it('formats any sum of twelfths, e.g. ⅓ + ½ = ⅚ ordered, ⅙ left over', () => {
		expect(formatQty(10, 'en')).toBe('⅚');
		expect(formatQty(2, 'en')).toBe('⅙');
		expect(formatQty(13, 'en')).toBe('1 1/12');
		expect(formatQty(7, 'bn')).toBe('৭/১২');
	});
});

describe('review fixes', () => {
	it('− on a fraction-only value clears it', () => {
		expect(stepWhole(6, -1)).toBe(0);
		expect(stepWhole(18, -1)).toBe(6);
	});

	it('flags a receipt line whose amount includes a leftover share', () => {
		// ½ dal at ৳30 a piece, charged ৳22.50 because ⅔ of a bowl was unclaimed.
		expect(includesLeftover(6, 3000, 2250)).toBe(true);
		expect(includesLeftover(6, 3000, 1500)).toBe(false);
		expect(includesLeftover(24, 1000, 2000)).toBe(false);
		// Rounding to the poisha is not a leftover.
		expect(includesLeftover(4, 1001, 334)).toBe(false);
	});
});
