/**
 * Money is always an integer number of poisha (1 taka = 100 poisha).
 * Never do arithmetic on taka floats; convert at the edges only.
 */
export type Poisha = number;

export type Locale = 'bn' | 'en';

const isSafeInt = (n: number) => Number.isSafeInteger(n);

/** Parse user input in taka ("12", "12.5", "১২.৫০", "1,250") into poisha. Returns null if invalid. */
export function parseTaka(input: string): Poisha | null {
	const ascii = input
		.trim()
		.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
		.replace(/[,\s৳]/g, '');
	const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(ascii);
	if (!m) return null;
	const poisha = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
	return isSafeInt(poisha) ? poisha : null;
}

/** Exact integer multiply for quantity × unit price. */
export function lineTotal(quantity: number, unitPrice: Poisha): Poisha {
	if (!isSafeInt(quantity) || !isSafeInt(unitPrice))
		throw new Error('Money values must be integers');
	return quantity * unitPrice;
}

export const sum = (values: Poisha[]): Poisha => values.reduce((a, b) => a + b, 0);

/** Format poisha for display, e.g. 125050 → "৳১,২৫০.৫০" (bn) or "৳1,250.50" (en). Drops ".00". */
export function formatTaka(poisha: Poisha, locale: Locale = 'bn', opts: { sign?: boolean } = {}) {
	const abs = Math.abs(poisha);
	const hasFraction = abs % 100 !== 0;
	const formatted = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
		minimumFractionDigits: hasFraction ? 2 : 0,
		maximumFractionDigits: 2
	}).format(abs / 100);
	const sign = poisha < 0 ? '−' : opts.sign && poisha > 0 ? '+' : '';
	return `${sign}৳${formatted}`;
}

/**
 * Split `total` poisha across `weights` (e.g. each member's quantity) in proportion,
 * returning integer shares that sum to exactly `total`.
 * Largest-remainder method: everyone gets the floor of their exact share, then leftover
 * poisha go one each to the largest fractional parts; ties go to the earlier index.
 * Callers should pass weights in a stable order (e.g. sorted by user id) so results are reproducible.
 */
export function allocate(total: Poisha, weights: number[]): Poisha[] {
	if (!isSafeInt(total) || total < 0) throw new Error('Total must be a non-negative integer');
	if (weights.some((w) => !isSafeInt(w) || w < 0))
		throw new Error('Weights must be non-negative integers');
	const units = weights.reduce((a, b) => a + b, 0);
	if (units === 0) {
		if (total !== 0) throw new Error('Cannot allocate a cost across zero units');
		return weights.map(() => 0);
	}
	// Integer math only: exact share = total * w / units.
	const shares = weights.map((w) => Math.floor((total * w) / units));
	const remainders = weights.map((w, i) => ({ i, r: (total * w) % units }));
	let left = total - shares.reduce((a, b) => a + b, 0);
	remainders.sort((a, b) => b.r - a.r || a.i - b.i);
	for (const { i } of remainders) {
		if (left === 0) break;
		shares[i] += 1;
		left -= 1;
	}
	return shares;
}
