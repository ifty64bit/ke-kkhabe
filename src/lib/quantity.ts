import { formatNumber, type Locale } from '#lib/i18n/index.ts';
import type { Poisha } from '#lib/money.ts';

/**
 * Quantities are always an integer number of twelfths of an item (12 = 1 item),
 * so people can share an item: ¼ = 3, ⅓ = 4, ½ = 6, ⅔ = 8, ¾ = 9.
 * Twelve divides evenly by 2, 3, 4 and 6, so every allowed fraction is exact.
 * Like poisha for money: integers everywhere, convert at the edges only.
 */
export const PORTION = 12;

/** Allowed fractional parts, in twelfths: —, ¼, ⅓, ½, ⅔, ¾. */
export const FRACTIONS: readonly number[] = [0, 3, 4, 6, 8, 9];

export const FRACTION_GLYPH: Record<number, string> = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 9: '¾' };

const MAX_WHOLE = 20;
/** At most 20 whole items per person per item. */
export const MAX_UNITS = MAX_WHOLE * PORTION;

export const split = (units: number) => ({
	whole: Math.floor(units / PORTION),
	fraction: units % PORTION
});

export const join = (whole: number, fraction: number) => whole * PORTION + fraction;

export const isValidQty = (units: number) =>
	Number.isInteger(units) &&
	units >= 0 &&
	units <= MAX_UNITS &&
	FRACTIONS.includes(units % PORTION);

/** Whole items to buy for an ordered amount: always rounded up. */
export const toBuy = (units: number) => Math.ceil(units / PORTION);

/** The part of the bought items nobody ordered, in twelfths. */
export const leftover = (units: number) => toBuy(units) * PORTION - units;

/** Per-piece price from an item's total cost and the twelfths eaten (cost ÷ whole items bought). */
export const pricePerPiece = (totalCost: Poisha, units: number): Poisha =>
	units > 0 ? Math.round(totalCost / toBuy(units)) : 0;

/** Add or remove one whole item, keeping the fraction; never above `MAX_UNITS`. */
export function stepWhole(units: number, delta: 1 | -1): number {
	const { whole, fraction } = split(units);
	const next = Math.min(MAX_WHOLE, Math.max(0, whole + delta));
	return Math.min(MAX_UNITS, join(next, fraction));
}

export const canSetFraction = (units: number, fraction: number) =>
	join(split(units).whole, fraction) <= MAX_UNITS;

/** Replace the fractional part; unchanged if that would pass `MAX_UNITS`. */
export const setFraction = (units: number, fraction: number) =>
	canSetFraction(units, fraction) ? join(split(units).whole, fraction) : units;

/** Display a quantity, e.g. 16 → "1⅓", 6 → "½" (Bangla digits in `bn`). */
export function formatQty(units: number, locale: Locale): string {
	const { whole, fraction } = split(units);
	const glyph = FRACTION_GLYPH[fraction] ?? '';
	if (whole === 0 && glyph) return glyph;
	return formatNumber(whole, locale) + glyph;
}
