import { pushSubscription } from '#lib/server/db/schema.ts';
import { b64uDecode } from './base64url.ts';
import { PUSH_EVENTS, type Prefs } from './events.ts';
import type { PushTarget } from './webpush.ts';

export type ParsedSubscription = { ok: true; value: PushTarget } | { ok: false };

function decodedLength(value: string): number {
	try {
		return b64uDecode(value).length;
	} catch {
		return 0;
	}
}

export function parseSubscriptionForm(form: FormData): ParsedSubscription {
	const endpoint = String(form.get('endpoint') ?? '');
	const p256dh = String(form.get('p256dh') ?? '');
	const auth = String(form.get('auth') ?? '');

	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return { ok: false };
	}
	if (url.protocol !== 'https:' || endpoint.length > 1024) return { ok: false };
	if (decodedLength(p256dh) !== 65) return { ok: false };
	if (decodedLength(auth) !== 16) return { ok: false };
	return { ok: true, value: { endpoint, p256dh, auth } };
}

export function upsertSubscriptionValues(
	userId: string,
	sub: PushTarget,
	userAgent: string | null
): {
	insert: typeof pushSubscription.$inferInsert;
	onConflictSet: Partial<typeof pushSubscription.$inferInsert>;
} {
	return {
		insert: {
			userId,
			endpoint: sub.endpoint,
			p256dh: sub.p256dh,
			auth: sub.auth,
			userAgent
		},
		onConflictSet: { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent }
	};
}

export function parsePrefsForm(form: FormData): Prefs {
	return Object.fromEntries(PUSH_EVENTS.map((event) => [event, form.get(event) === 'on'])) as Prefs;
}
