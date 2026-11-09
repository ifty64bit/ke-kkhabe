export type PushEvent = 'dayOpened' | 'dayFinalized' | 'settlementPending' | 'settlementDecided';

export type PushData = {
	dayOpened: { date: string };
	dayFinalized: { date: string; charge: number };
	settlementPending: { id: string; fromName: string; amount: number };
	settlementDecided: {
		id: string;
		deciderName: string;
		amount: number;
		approved: boolean;
		reason: string | null;
	};
};

export type NotifyRequest<E extends PushEvent = PushEvent> = {
	event: E;
	actorId: string;
	recipients: { userId: string; data: PushData[E] }[];
};

export type PushMessage = { title: string; body: string; url: string; tag: string };
export type Prefs = Record<PushEvent, boolean>;

export const PUSH_EVENTS: readonly PushEvent[] = [
	'dayOpened',
	'dayFinalized',
	'settlementPending',
	'settlementDecided'
];
