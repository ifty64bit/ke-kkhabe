import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Db } from '#lib/server/db/index.ts';
import { notificationPref, pushSubscription, user } from '#lib/server/db/schema.ts';
import type { PushEvent } from './events.ts';
import type { PushStore } from './notify.ts';

const prefColumns = {
	dayOpened: notificationPref.dayOpened,
	dayFinalized: notificationPref.dayFinalized,
	settlementPending: notificationPref.settlementPending,
	settlementDecided: notificationPref.settlementDecided
} as const;

export function d1PushStore(db: Db): PushStore {
	return {
		async targets(userIds, event: PushEvent) {
			if (userIds.length === 0) return [];
			const pref = prefColumns[event];
			return db
				.select({
					subscriptionId: pushSubscription.id,
					userId: pushSubscription.userId,
					locale: user.locale,
					endpoint: pushSubscription.endpoint,
					p256dh: pushSubscription.p256dh,
					auth: pushSubscription.auth
				})
				.from(pushSubscription)
				.innerJoin(user, eq(user.id, pushSubscription.userId))
				.leftJoin(notificationPref, eq(notificationPref.userId, pushSubscription.userId))
				.where(
					and(
						inArray(pushSubscription.userId, userIds),
						eq(user.active, true),
						or(isNull(pref), eq(pref, true))
					)
				);
		},
		async remove(subscriptionIds) {
			if (subscriptionIds.length === 0) return;
			await db.delete(pushSubscription).where(inArray(pushSubscription.id, subscriptionIds));
		},
		async markSuccess(subscriptionIds, at) {
			if (subscriptionIds.length === 0) return;
			await db
				.update(pushSubscription)
				.set({ lastSuccessAt: at })
				.where(inArray(pushSubscription.id, subscriptionIds));
		}
	};
}
