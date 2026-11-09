import { describe, expect, it, vi } from 'vitest';
import { formatTaka } from '#lib/money.ts';
import { notify, vapidFromEnv, type PushStore, type TargetRow } from './notify.ts';
import { sendWebPush } from './webpush.ts';

const vapid = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.c' };

function row(partial: Partial<TargetRow>): TargetRow {
	return {
		subscriptionId: 's1',
		userId: 'u1',
		locale: 'en',
		endpoint: 'https://push.example/s1',
		p256dh: 'p',
		auth: 'a',
		...partial
	};
}

function fakeStore(rows: TargetRow[] = []) {
	const calls = {
		targets: [] as { userIds: string[]; event: string }[],
		remove: [] as string[][],
		markSuccess: [] as { ids: string[]; at: Date }[]
	};
	const store: PushStore = {
		async targets(userIds, event) {
			calls.targets.push({ userIds, event });
			return rows.filter((r) => userIds.includes(r.userId));
		},
		async remove(ids) {
			calls.remove.push(ids);
		},
		async markSuccess(ids, at) {
			calls.markSuccess.push({ ids, at });
		}
	};
	return { store, calls };
}

function fakeSender(result: Record<string, number | 'throw'>, calls: FakeSendCall[] = []) {
	const send = async (
		target: { endpoint: string },
		payload: string,
		_vapid: unknown,
		opts?: { urgency?: string }
	) => {
		calls.push({ endpoint: target.endpoint, payload, urgency: opts?.urgency });
		const status = result[target.endpoint];
		if (status === 'throw') throw new Error('network down');
		return { status };
	};
	return { send: send as unknown as typeof sendWebPush, calls };
}

type FakeSendCall = { endpoint: string; payload: string; urgency?: string };

const message = (call: FakeSendCall) =>
	JSON.parse(call.payload) as { title: string; body: string; url: string; tag: string };

describe('vapidFromEnv', () => {
	it('needs all three values', () => {
		expect(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' })).toBeNull();
		expect(
			vapidFromEnv({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x' })
		).toBeNull();
		expect(
			vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x' })
		).toEqual({ publicKey: 'a', privateKey: 'b', subject: 'mailto:x' });
	});
});

describe('notify', () => {
	it('sends nothing when vapid is null', async () => {
		const { store, calls } = fakeStore([row({})]);
		const send = vi.fn();
		await notify(
			store,
			null,
			{ event: 'dayOpened', actorId: 'x', recipients: [{ userId: 'u1', data: { date: 'd' } }] },
			{ send }
		);
		expect(send).not.toHaveBeenCalled();
		expect(calls.targets).toEqual([]);
	});

	it('drops the actor before querying', async () => {
		const { store, calls } = fakeStore([]);
		await notify(
			store,
			vapid,
			{
				event: 'dayOpened',
				actorId: 'u1',
				recipients: [
					{ userId: 'u1', data: { date: 'd' } },
					{ userId: 'u2', data: { date: 'd' } }
				]
			},
			{ send: fakeSender({}).send }
		);
		expect(calls.targets[0].userIds).toEqual(['u2']);
	});

	it('does nothing when no recipients remain', async () => {
		const { store, calls } = fakeStore([]);
		await notify(
			store,
			vapid,
			{ event: 'dayOpened', actorId: 'u1', recipients: [{ userId: 'u1', data: { date: 'd' } }] },
			{ send: fakeSender({}).send }
		);
		expect(calls.targets).toEqual([]);
	});

	it('builds each message in the recipient locale', async () => {
		const { store } = fakeStore([
			row({ userId: 'u1', locale: 'bn' }),
			row({ subscriptionId: 's2', userId: 'u2', locale: null, endpoint: 'https://push.example/s2' })
		]);
		const { send, calls } = fakeSender({});
		await notify(
			store,
			vapid,
			{
				event: 'dayOpened',
				actorId: 'x',
				recipients: [
					{ userId: 'u1', data: { date: '2026-11-09' } },
					{ userId: 'u2', data: { date: '2026-11-09' } }
				]
			},
			{ send }
		);
		expect(message(calls[0]).title).toBe('আজ খাবেন?');
		expect(message(calls[1]).title).toBe('আজ খাবেন?');
	});

	it('uses recipient-specific data', async () => {
		const { store } = fakeStore([
			row({ userId: 'u1', locale: 'en' }),
			row({ subscriptionId: 's2', userId: 'u2', locale: 'en', endpoint: 'https://push.example/s2' })
		]);
		const { send, calls } = fakeSender({});
		await notify(
			store,
			vapid,
			{
				event: 'dayFinalized',
				actorId: 'x',
				recipients: [
					{ userId: 'u1', data: { date: '2026-11-09', charge: 100 } },
					{ userId: 'u2', data: { date: '2026-11-09', charge: 200 } }
				]
			},
			{ send }
		);
		expect(message(calls[0]).body).toContain(formatTaka(100, 'en'));
		expect(message(calls[1]).body).toContain(formatTaka(200, 'en'));
	});

	it('removes 404/410 subscriptions and marks 2xx success', async () => {
		const { store, calls: storeCalls } = fakeStore([
			row({ subscriptionId: 's1', userId: 'u1', endpoint: 'https://push.example/s1' }),
			row({ subscriptionId: 's2', userId: 'u2', endpoint: 'https://push.example/s2' }),
			row({ subscriptionId: 's3', userId: 'u3', endpoint: 'https://push.example/s3' })
		]);
		const now = new Date('2026-11-09T10:00:00Z');
		const { send } = fakeSender({
			'https://push.example/s1': 201,
			'https://push.example/s2': 410,
			'https://push.example/s3': 404
		});
		await notify(
			store,
			vapid,
			{
				event: 'dayFinalized',
				actorId: 'x',
				recipients: [
					{ userId: 'u1', data: { date: 'd', charge: 1 } },
					{ userId: 'u2', data: { date: 'd', charge: 2 } },
					{ userId: 'u3', data: { date: 'd', charge: 3 } }
				]
			},
			{ send, now: () => now }
		);
		expect(storeCalls.remove).toEqual([['s2', 's3']]);
		expect(storeCalls.markSuccess).toEqual([{ ids: ['s1'], at: now }]);
	});

	it('keeps rows and resolves on 500 or a thrown send, and still sends the rest', async () => {
		const { store, calls: storeCalls } = fakeStore([
			row({ subscriptionId: 's1', userId: 'u1', endpoint: 'https://push.example/s1' }),
			row({ subscriptionId: 's2', userId: 'u2', endpoint: 'https://push.example/s2' }),
			row({ subscriptionId: 's3', userId: 'u3', endpoint: 'https://push.example/s3' })
		]);
		const { send, calls } = fakeSender({
			'https://push.example/s1': 500,
			'https://push.example/s2': 'throw',
			'https://push.example/s3': 201
		});
		await expect(
			notify(
				store,
				vapid,
				{
					event: 'dayFinalized',
					actorId: 'x',
					recipients: [
						{ userId: 'u1', data: { date: 'd', charge: 1 } },
						{ userId: 'u2', data: { date: 'd', charge: 2 } },
						{ userId: 'u3', data: { date: 'd', charge: 3 } }
					]
				},
				{ send }
			)
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(3);
		expect(storeCalls.remove).toEqual([]);
		expect(storeCalls.markSuccess).toEqual([{ ids: ['s3'], at: expect.any(Date) }]);
	});

	it('never rejects when the store throws', async () => {
		const store: PushStore = {
			async targets() {
				throw new Error('db down');
			},
			async remove() {},
			async markSuccess() {}
		};
		await expect(
			notify(
				store,
				vapid,
				{ event: 'dayOpened', actorId: 'x', recipients: [{ userId: 'u1', data: { date: 'd' } }] },
				{ send: fakeSender({}).send }
			)
		).resolves.toBeUndefined();
	});

	it('uses urgency high only for dayOpened', async () => {
		const opened = fakeStore([row({})]);
		const openedSend = fakeSender({});
		await notify(
			opened.store,
			vapid,
			{ event: 'dayOpened', actorId: 'x', recipients: [{ userId: 'u1', data: { date: 'd' } }] },
			{ send: openedSend.send }
		);
		expect(openedSend.calls[0].urgency).toBe('high');

		const finalized = fakeStore([row({})]);
		const finalizedSend = fakeSender({});
		await notify(
			finalized.store,
			vapid,
			{
				event: 'dayFinalized',
				actorId: 'x',
				recipients: [{ userId: 'u1', data: { date: 'd', charge: 1 } }]
			},
			{ send: finalizedSend.send }
		);
		expect(finalizedSend.calls[0].urgency).toBe('normal');
	});
});
