import { desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { settlement, user } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

/** Every settlement the viewer paid or received, in any state, with the names around it. */
export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user!;
	const fromUser = alias(user, 'from_user');
	const toUser = alias(user, 'to_user');
	const recorder = alias(user, 'recorder');
	const decider = alias(user, 'decider');
	const voider = alias(user, 'voider');

	const rows = await locals.db
		.select({
			id: settlement.id,
			date: settlement.date,
			fromId: settlement.fromUserId,
			fromName: fromUser.name,
			toId: settlement.toUserId,
			toName: toUser.name,
			amount: settlement.amount,
			note: settlement.note,
			status: settlement.status,
			rejectReason: settlement.rejectReason,
			createdBy: settlement.createdBy,
			createdByName: recorder.name,
			decidedByName: decider.name,
			voidedAt: settlement.voidedAt,
			voidedByName: voider.name
		})
		.from(settlement)
		.innerJoin(fromUser, eq(fromUser.id, settlement.fromUserId))
		.innerJoin(toUser, eq(toUser.id, settlement.toUserId))
		.leftJoin(recorder, eq(recorder.id, settlement.createdBy))
		.leftJoin(decider, eq(decider.id, settlement.decidedBy))
		.leftJoin(voider, eq(voider.id, settlement.voidedBy))
		.where(or(eq(settlement.fromUserId, me.id), eq(settlement.toUserId, me.id)))
		.orderBy(desc(settlement.date), desc(settlement.createdAt));

	return { meId: me.id, rows };
};
