import { isValidQty } from '#lib/quantity.ts';

export type WantedLine = { itemId: string; quantity: number };

/**
 * Read `qty:<itemId>` fields (twelfths of an item) from an order form.
 * Returns the positive lines, or null when any field is invalid: an item not in `allowed`,
 * a quantity that is not a whole number plus an allowed fraction (see `isValidQty`), or the
 * same item twice.
 */
export function parseOrderForm(form: FormData, allowed: Set<string>): WantedLine[] | null {
	const wanted: WantedLine[] = [];
	const seen = new Set<string>();
	for (const [key, raw] of form) {
		if (!key.startsWith('qty:')) continue;
		const itemId = key.slice(4);
		const quantity = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
		if (!allowed.has(itemId) || seen.has(itemId) || !isValidQty(quantity)) return null;
		seen.add(itemId);
		if (quantity > 0) wanted.push({ itemId, quantity });
	}
	return wanted;
}
