import { describe, expect, it } from 'vitest';
import { formatTaka } from '#lib/money.ts';
import { buildMessage } from './messages.ts';

describe('buildMessage', () => {
	it('dayOpened links home, tagged by date', () => {
		expect(buildMessage('dayOpened', { date: '2026-11-09' }, 'en')).toEqual({
			title: 'Breakfast is open',
			body: 'Will you eat today? Order now',
			url: '/',
			tag: 'day-2026-11-09'
		});
	});

	it('dayFinalized formats the charge per locale', () => {
		const en = buildMessage('dayFinalized', { date: '2026-11-09', charge: 8500 }, 'en');
		expect(en).toMatchObject({ url: '/ledger', tag: 'bill-2026-11-09' });
		expect(en.body).toBe(`Your charge: ${formatTaka(8500, 'en')}`);
		expect(buildMessage('dayFinalized', { date: '2026-11-09', charge: 8500 }, 'bn').body).toBe(
			`আপনার খরচ: ${formatTaka(8500, 'bn')}`
		);
	});

	it('settlementPending names the payer and links to the ledger', () => {
		expect(
			buildMessage('settlementPending', { id: 's1', fromName: 'Rahim', amount: 20000 }, 'en')
		).toMatchObject({
			url: '/ledger',
			tag: 'settlement-s1',
			body: `Rahim → you ${formatTaka(20000, 'en')}, waiting for your approval`
		});
	});

	it('settlementDecided approved / rejected with and without reason', () => {
		const approved = buildMessage(
			'settlementDecided',
			{ id: 's1', deciderName: 'Karim', amount: 20000, approved: true, reason: null },
			'en'
		);
		expect(approved).toEqual({
			title: 'Settlement approved',
			body: `Karim approved ${formatTaka(20000, 'en')}`,
			url: '/ledger',
			tag: 'settlement-s1'
		});

		const rejected = buildMessage(
			'settlementDecided',
			{ id: 's1', deciderName: 'Karim', amount: 20000, approved: false, reason: null },
			'en'
		);
		expect(rejected).toEqual({
			title: 'Settlement rejected',
			body: `Karim rejected ${formatTaka(20000, 'en')}`,
			url: '/ledger',
			tag: 'settlement-s1'
		});

		const withReason = buildMessage(
			'settlementDecided',
			{ id: 's1', deciderName: 'Karim', amount: 20000, approved: false, reason: 'not yet' },
			'en'
		);
		expect(withReason.body).toBe(`Karim rejected ${formatTaka(20000, 'en')}: not yet`);
		expect(withReason.url).toBe('/ledger');
		expect(withReason.tag).toBe('settlement-s1');
	});

	it('foodArrived opens home with high-priority tag per day, in both locales', () => {
		expect(buildMessage('foodArrived', { date: '2026-11-09' }, 'en')).toEqual({
			title: 'Breakfast is here',
			body: 'Come and get it',
			url: '/',
			tag: 'arrived-2026-11-09'
		});
		expect(buildMessage('foodArrived', { date: '2026-11-09' }, 'bn')).toMatchObject({
			title: 'নাস্তা চলে এসেছে',
			body: 'এসে নিয়ে যান'
		});
	});
});
