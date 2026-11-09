import { describe, expect, it } from 'vitest';
import { b64uEncode } from './base64url.ts';
import {
	parsePrefsForm,
	parseSubscriptionForm,
	upsertSubscriptionValues
} from './subscriptions.ts';

const p256dh = b64uEncode(new Uint8Array(65).fill(1));
const auth = b64uEncode(new Uint8Array(16).fill(2));

function form(overrides: Record<string, string | null> = {}) {
	const f = new FormData();
	const values: Record<string, string | null> = {
		endpoint: 'https://push.example/abc',
		p256dh,
		auth,
		...overrides
	};
	for (const [key, value] of Object.entries(values)) if (value !== null) f.set(key, value);
	return f;
}

describe('parseSubscriptionForm', () => {
	it('accepts a well-formed subscription', () => {
		expect(parseSubscriptionForm(form())).toEqual({
			ok: true,
			value: { endpoint: 'https://push.example/abc', p256dh, auth }
		});
	});

	it('rejects http endpoints, bad key lengths, missing fields', () => {
		expect(parseSubscriptionForm(form({ endpoint: 'http://push.example/abc' })).ok).toBe(false);
		expect(
			parseSubscriptionForm(form({ endpoint: `https://push.example/${'x'.repeat(1024)}` })).ok
		).toBe(false);
		expect(parseSubscriptionForm(form({ p256dh: b64uEncode(new Uint8Array(64)) })).ok).toBe(false);
		expect(parseSubscriptionForm(form({ auth: b64uEncode(new Uint8Array(15)) })).ok).toBe(false);
		expect(parseSubscriptionForm(form({ endpoint: null })).ok).toBe(false);
		expect(parseSubscriptionForm(form({ p256dh: null })).ok).toBe(false);
		expect(parseSubscriptionForm(form({ auth: null })).ok).toBe(false);
		expect(parseSubscriptionForm(form({ p256dh: 'not base64!' })).ok).toBe(false);
	});
});

describe('upsertSubscriptionValues', () => {
	it('upsert moves an existing endpoint to the new user', () => {
		const v = upsertSubscriptionValues(
			'u2',
			{ endpoint: 'https://p/x', p256dh: 'P', auth: 'A' },
			'UA'
		);
		expect(v.insert).toMatchObject({
			userId: 'u2',
			endpoint: 'https://p/x',
			p256dh: 'P',
			auth: 'A',
			userAgent: 'UA'
		});
		expect(v.onConflictSet).toEqual({ userId: 'u2', p256dh: 'P', auth: 'A', userAgent: 'UA' });
	});
});

describe('parsePrefsForm', () => {
	it('unchecked switches are false', () => {
		const f = new FormData();
		f.set('dayOpened', 'on');
		f.set('settlementDecided', 'on');
		expect(parsePrefsForm(f)).toEqual({
			dayOpened: true,
			dayFinalized: false,
			settlementPending: false,
			settlementDecided: true
		});
	});
});
