import type { NotifyRequest } from './events.ts';

export function pendingRecipient(
	s: { id: string; toUserId: string; amount: number; status: string },
	fromName: string
): NotifyRequest<'settlementPending'>['recipients'] {
	return s.status === 'pending'
		? [{ userId: s.toUserId, data: { id: s.id, fromName, amount: s.amount } }]
		: [];
}

export function decidedRecipient(
	s: { id: string; createdBy: string; amount: number },
	deciderName: string,
	approved: boolean,
	reason: string | null
): NotifyRequest<'settlementDecided'>['recipients'] {
	return [
		{
			userId: s.createdBy,
			data: { id: s.id, deciderName, amount: s.amount, approved, reason }
		}
	];
}

export function finalizedRecipients(
	charges: Map<string, number>,
	date: string
): NotifyRequest<'dayFinalized'>['recipients'] {
	return [...charges.entries()].map(([userId, charge]) => ({ userId, data: { date, charge } }));
}

export function arrivedRecipients(
	responses: { userId: string; eating: boolean }[],
	date: string
): NotifyRequest<'foodArrived'>['recipients'] {
	return responses.filter((r) => r.eating).map((r) => ({ userId: r.userId, data: { date } }));
}
