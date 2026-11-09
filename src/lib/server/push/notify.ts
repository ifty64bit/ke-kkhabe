import { isLocale, type Locale } from '#lib/i18n/index.ts';
import type { NotifyRequest, PushData, PushEvent } from './events.ts';
import { buildMessage } from './messages.ts';
import { sendWebPush, type PushTarget, type Vapid } from './webpush.ts';

export type TargetRow = {
	subscriptionId: string;
	userId: string;
	locale: string | null;
} & PushTarget;

export interface PushStore {
	/** Subscriptions of these users who are active and have `event` enabled (missing pref row = enabled). */
	targets(userIds: string[], event: PushEvent): Promise<TargetRow[]>;
	remove(subscriptionIds: string[]): Promise<void>;
	markSuccess(subscriptionIds: string[], at: Date): Promise<void>;
}

export function vapidFromEnv(env: {
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
}): Vapid | null {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
	return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

/** Origin only: logs must never include keys or the full endpoint. */
function endpointOrigin(endpoint: string): string {
	try {
		return new URL(endpoint).origin;
	} catch {
		return 'invalid-endpoint';
	}
}

export async function notify(
	store: PushStore,
	vapid: Vapid | null,
	req: NotifyRequest,
	deps: { send?: typeof sendWebPush; now?: () => Date } = {}
): Promise<void> {
	if (!vapid) return;
	try {
		const recipients = req.recipients.filter((r) => r.userId !== req.actorId);
		if (recipients.length === 0) return;

		const userIds = [...new Set(recipients.map((r) => r.userId))];
		const rows = await store.targets(userIds, req.event);
		if (rows.length === 0) return;

		const dataOf = new Map(recipients.map((r) => [r.userId, r.data]));
		const send = deps.send ?? sendWebPush;
		const urgency = req.event === 'dayOpened' ? 'high' : 'normal';

		const results = await Promise.allSettled(
			rows.map(async (row) => {
				try {
					const data = dataOf.get(row.userId) as PushData[PushEvent];
					const locale: Locale = isLocale(row.locale) ? row.locale : 'bn';
					const message = buildMessage(req.event, data, locale);
					const { status } = await send(
						{ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
						JSON.stringify(message),
						vapid,
						{ urgency }
					);
					return { row, status };
				} catch {
					console.warn('[push]', `${endpointOrigin(row.endpoint)} send failed`);
					return { row, status: null };
				}
			})
		);

		const dead: string[] = [];
		const succeeded: string[] = [];
		for (const result of results) {
			if (result.status === 'rejected') continue;
			const { row, status } = result.value;
			if (status === null) continue;
			if (status === 404 || status === 410) dead.push(row.subscriptionId);
			else if (status >= 200 && status < 300) succeeded.push(row.subscriptionId);
			else console.warn('[push]', `${endpointOrigin(row.endpoint)} ${status}`);
		}

		if (dead.length > 0) await store.remove(dead);
		if (succeeded.length > 0)
			await store.markSuccess(succeeded, (deps.now ?? (() => new Date()))());
	} catch (error) {
		console.warn('[push]', error instanceof Error ? error.message : 'notify failed');
	}
}
