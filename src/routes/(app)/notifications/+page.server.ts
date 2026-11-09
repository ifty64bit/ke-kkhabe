import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { notificationPref, pushSubscription } from '#lib/server/db/schema.ts';
import type { Prefs } from '#lib/server/push/events.ts';
import { vapidFromEnv } from '#lib/server/push/notify.ts';
import {
	parsePrefsForm,
	parseSubscriptionForm,
	upsertSubscriptionValues
} from '#lib/server/push/subscriptions.ts';
import type { Actions, PageServerLoad } from './$types';

const allOn = (): Prefs => ({
	dayOpened: true,
	dayFinalized: true,
	settlementPending: true,
	settlementDecided: true
});

export const load: PageServerLoad = async ({ locals }) => {
	const [pref] = await locals.db
		.select()
		.from(notificationPref)
		.where(eq(notificationPref.userId, locals.user!.id))
		.limit(1);
	const prefs: Prefs = pref
		? {
				dayOpened: pref.dayOpened,
				dayFinalized: pref.dayFinalized,
				settlementPending: pref.settlementPending,
				settlementDecided: pref.settlementDecided
			}
		: allOn();
	return { vapidPublicKey: vapidFromEnv(env)?.publicKey ?? null, prefs };
};

export const actions: Actions = {
	subscribe: async ({ locals, request }) => {
		const parsed = parseSubscriptionForm(await request.formData());
		if (!parsed.ok) return fail(400, { saved: false });
		const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? null;
		const values = upsertSubscriptionValues(locals.user!.id, parsed.value, userAgent);
		await locals.db
			.insert(pushSubscription)
			.values(values.insert)
			.onConflictDoUpdate({ target: pushSubscription.endpoint, set: values.onConflictSet });
		return { saved: true };
	},

	unsubscribe: async ({ locals, request }) => {
		const form = await request.formData();
		const endpoint = String(form.get('endpoint') ?? '');
		if (!endpoint) return fail(400, { saved: false });
		await locals.db
			.delete(pushSubscription)
			.where(
				and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, locals.user!.id))
			);
		return { saved: true };
	},

	savePrefs: async ({ locals, request }) => {
		const prefs = parsePrefsForm(await request.formData());
		await locals.db
			.insert(notificationPref)
			.values({ userId: locals.user!.id, ...prefs })
			.onConflictDoUpdate({ target: notificationPref.userId, set: prefs });
		return { saved: true };
	}
};
