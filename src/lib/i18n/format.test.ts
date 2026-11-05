import { describe, expect, it } from 'vitest';
import { formatMonth, formatShortDay } from '#lib/i18n/index.ts';

describe('month and short day formats', () => {
	it('names a YYYY-MM month', () => {
		expect(formatMonth('2026-11', 'en')).toBe('November 2026');
		expect(formatMonth('2026-11', 'bn')).toBe('নভেম্বর ২০২৬');
	});

	it('shortens a YYYY-MM-DD day', () => {
		expect(formatShortDay('2026-11-05', 'en')).toBe('5 Nov');
		expect(formatShortDay('2026-11-05', 'bn')).toBe('৫ নভে');
	});
});
