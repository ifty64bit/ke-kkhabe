import { env } from 'cloudflare:workers';
import type { NotifyRequest } from './events.ts';
import { notify, vapidFromEnv } from './notify.ts';
import { d1PushStore } from './store.ts';

/**
 * Send push notifications off the response path. Never throws: the action that triggered
 * it must succeed even when there are no keys, no subscriptions, or the push service is down.
 */
export function queueNotify(
	event: { locals: App.Locals; platform?: App.Platform },
	req: NotifyRequest | (() => Promise<NotifyRequest>)
): void {
	const promise = (async () => {
		const resolved = typeof req === 'function' ? await req() : req;
		await notify(d1PushStore(event.locals.db), vapidFromEnv(env), resolved);
	})().catch((error) => {
		console.warn('[push]', error instanceof Error ? error.message : 'notify queue failed');
	});

	event.platform?.ctx.waitUntil(promise);
	void promise;
}
