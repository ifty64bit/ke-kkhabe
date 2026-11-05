import { leftover, PORTION } from '#lib/quantity.ts';

/**
 * Sharing an item: people order halves, and two halves make one item to buy.
 * Pure helpers shared by the order dialog, the close-orders warning and finalize.
 * Quantities are twelfths (see `#lib/quantity.ts`).
 *
 * FUTURE: these rules assume halves are the only fraction (see `FRACTIONS`). With ¼ or ⅓
 * enabled, the open part of an item could be ⅙ or ⅔, and "the latest half pays for it"
 * would need a different rule for who covers what.
 */

export type ShareLine = { userId: string; itemId: string; quantity: number };
/** `at`: when this person last changed their order (ms), to find who ordered last. */
export type TimedShareLine = ShareLine & { at: number };

const totalsByItem = (lines: ShareLine[]) => {
	const totals = new Map<string, number>();
	for (const l of lines) totals.set(l.itemId, (totals.get(l.itemId) ?? 0) + l.quantity);
	return totals;
};

/** The unclaimed part of each item that has one, in twelfths (e.g. dal → 6 for ½). */
export function openShares(lines: ShareLine[]): Map<string, number> {
	const open = new Map<string, number>();
	for (const [itemId, units] of totalsByItem(lines)) {
		const left = leftover(units);
		if (left > 0) open.set(itemId, left);
	}
	return open;
}

/** Latest first; a tie in time goes to the larger user id, so the order is stable. */
const latestFirst = (a: TimedShareLine, b: TimedShareLine) =>
	b.at - a.at || (a.userId < b.userId ? 1 : a.userId > b.userId ? -1 : 0);

/**
 * For each item with an unclaimed part: the people holding a fraction of it, latest first.
 * The first one is who `topUpLeftovers` charges for the unclaimed part.
 */
export function shareHolders<T extends TimedShareLine>(lines: T[]): Map<string, T[]> {
	const open = openShares(lines);
	const holders = new Map<string, T[]>();
	for (const itemId of open.keys()) {
		holders.set(
			itemId,
			lines.filter((l) => l.itemId === itemId && l.quantity % PORTION > 0).toSorted(latestFirst)
		);
	}
	return holders;
}

/**
 * Default final quantities: an unclaimed part of an item is added to the person who
 * ordered a fraction of it last, so an unmatched ½ becomes a whole (½ → 1, 1½ → 2).
 * Returns new lines; matched items and whole orders are unchanged.
 */
export function topUpLeftovers<T extends TimedShareLine>(lines: T[]): T[] {
	const open = openShares(lines);
	const topped = new Map<T, number>();
	for (const [itemId, holders] of shareHolders(lines)) {
		const latest = holders[0];
		if (latest) topped.set(latest, latest.quantity + (open.get(itemId) ?? 0));
	}
	return lines.map((l) => (topped.has(l) ? { ...l, quantity: topped.get(l)! } : l));
}
