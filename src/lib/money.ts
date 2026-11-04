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
