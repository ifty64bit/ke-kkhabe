import { describe, expect, it } from 'vitest';
import {
	arrivedRecipients,
	decidedRecipient,
	finalizedRecipients,
	pendingRecipient
} from './recipients.ts';

describe('recipients', () => {
	it('pending: notifies the receiver only while pending', () => {
		expect(
			pendingRecipient({ id: 's1', toUserId: 'A', amount: 5000, status: 'pending' }, 'B')
		).toEqual([{ userId: 'A', data: { id: 's1', fromName: 'B', amount: 5000 } }]);
		expect(
			pendingRecipient({ id: 's1', toUserId: 'A', amount: 5000, status: 'approved' }, 'B')
		).toEqual([]);
	});

	it('decided: notifies whoever recorded it (a manager, not the payer)', () => {
		expect(
			decidedRecipient({ id: 's1', createdBy: 'M', amount: 5000 }, 'A', false, 'not received')
		).toEqual([
			{
				userId: 'M',
				data: { id: 's1', deciderName: 'A', amount: 5000, approved: false, reason: 'not received' }
			}
		]);
	});

	it('finalized: one recipient per charged member with their own charge', () => {
		expect(
			finalizedRecipients(
				new Map([
					['u1', 8500],
					['u2', 4250]
				]),
				'2026-11-09'
			)
		).toEqual([
			{ userId: 'u1', data: { date: '2026-11-09', charge: 8500 } },
			{ userId: 'u2', data: { date: '2026-11-09', charge: 4250 } }
		]);
	});

	it('arrived: only members who said they are eating', () => {
		expect(
			arrivedRecipients(
				[
					{ userId: 'u1', eating: true },
					{ userId: 'u2', eating: false },
					{ userId: 'u3', eating: true }
				],
				'2026-11-09'
			)
		).toEqual([
			{ userId: 'u1', data: { date: '2026-11-09' } },
			{ userId: 'u3', data: { date: '2026-11-09' } }
		]);
	});
});
