import { translate, type Locale } from '#lib/i18n/index.ts';
import { formatTaka } from '#lib/money.ts';
import type { PushData, PushEvent, PushMessage } from './events.ts';

export function buildMessage<E extends PushEvent>(
	event: E,
	data: PushData[E],
	locale: Locale
): PushMessage {
	switch (event) {
		case 'dayOpened': {
			const d = data as PushData['dayOpened'];
			return {
				title: translate(locale, 'push.dayOpened.title'),
				body: translate(locale, 'push.dayOpened.body'),
				url: '/',
				tag: `day-${d.date}`
			};
		}
		case 'dayFinalized': {
			const d = data as PushData['dayFinalized'];
			return {
				title: translate(locale, 'push.dayFinalized.title'),
				body: translate(locale, 'push.dayFinalized.body', {
					amount: formatTaka(d.charge, locale)
				}),
				url: '/ledger',
				tag: `bill-${d.date}`
			};
		}
		case 'settlementPending': {
			const d = data as PushData['settlementPending'];
			return {
				title: translate(locale, 'push.settlementPending.title'),
				body: translate(locale, 'push.settlementPending.body', {
					name: d.fromName,
					amount: formatTaka(d.amount, locale)
				}),
				url: '/ledger',
				tag: `settlement-${d.id}`
			};
		}
		case 'settlementDecided': {
			const d = data as PushData['settlementDecided'];
			const params = { name: d.deciderName, amount: formatTaka(d.amount, locale) };
			if (d.approved) {
				return {
					title: translate(locale, 'push.settlementApproved.title'),
					body: translate(locale, 'push.settlementApproved.body', params),
					url: '/ledger',
					tag: `settlement-${d.id}`
				};
			}
			return {
				title: translate(locale, 'push.settlementRejected.title'),
				body: d.reason
					? translate(locale, 'push.settlementRejected.bodyReason', { ...params, reason: d.reason })
					: translate(locale, 'push.settlementRejected.body', params),
				url: '/ledger',
				tag: `settlement-${d.id}`
			};
		}
		case 'foodArrived': {
			const d = data as PushData['foodArrived'];
			return {
				title: translate(locale, 'push.foodArrived.title'),
				body: translate(locale, 'push.foodArrived.body'),
				url: '/',
				tag: `arrived-${d.date}`
			};
		}
	}
	throw new Error(`Unknown push event: ${event}`);
}
