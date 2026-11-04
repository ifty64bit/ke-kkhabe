import { fail } from '@sveltejs/kit';
import { and, count, eq, ne } from 'drizzle-orm';
import type { MessageKey } from '#lib/i18n/index.ts';
import { isAdminEmail } from '#lib/server/admins.ts';
import { requireManager } from '#lib/server/guards.ts';
import { auditLog, user } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const me = requireManager(locals);
	const rows = await locals.db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			role: user.role,
			active: user.active,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(user.name);

	return {
		meId: me.id,
		members: rows.map((r) => ({
			...r,
			role: r.role ?? 'member',
			active: r.active !== false,
			fromConfig: isAdminEmail(r.email)
		}))
	};
};

const failKey = (status: number, key: MessageKey) => fail(status, { messageKey: key });

/** Active managers other than `exceptId`. */
async function otherActiveManagers(db: Db, exceptId: string) {
	const [row] = await db
		.select({ n: count() })
		.from(user)
		.where(and(eq(user.role, 'manager'), eq(user.active, true), ne(user.id, exceptId)));
	return row.n;
}

async function target(db: Db, meId: string, form: FormData) {
	const id = String(form.get('id') ?? '');
	if (id === meId) return { error: failKey(403, 'members.error.self') };
	const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
	if (!row) return { error: failKey(404, 'members.error.notFound') };
	return { row };
}

export const actions: Actions = {
	setRole: async ({ locals, request }) => {
		const me = requireManager(locals);
		const form = await request.formData();
		const role = form.get('role');
		if (role !== 'manager' && role !== 'member') return failKey(400, 'members.error.invalid');

		const { row, error } = await target(locals.db, me.id, form);
		if (error) return error;
		if ((row.role ?? 'member') === role) return { saved: true };

		if (role === 'member') {
			if (isAdminEmail(row.email)) return failKey(409, 'members.error.config');
			if (row.active !== false && (await otherActiveManagers(locals.db, row.id)) === 0)
				return failKey(409, 'members.error.lastManager');
		}

		await locals.db.batch([
			locals.db.update(user).set({ role }).where(eq(user.id, row.id)),
			locals.db.insert(auditLog).values({
				actorId: me.id,
				action: 'member.role',
				entity: 'user',
				entityId: row.id,
				data: { from: row.role ?? 'member', to: role }
			})
		]);
		return { saved: true };
	},

	setActive: async ({ locals, request }) => {
		const me = requireManager(locals);
		const form = await request.formData();
		const active = form.get('active') === 'true';

		const { row, error } = await target(locals.db, me.id, form);
		if (error) return error;
		if ((row.active !== false) === active) return { saved: true };

		if (!active && row.role === 'manager' && (await otherActiveManagers(locals.db, row.id)) === 0)
			return failKey(409, 'members.error.lastManager');

		await locals.db.batch([
			locals.db.update(user).set({ active }).where(eq(user.id, row.id)),
			locals.db.insert(auditLog).values({
				actorId: me.id,
				action: active ? 'member.reactivate' : 'member.deactivate',
				entity: 'user',
				entityId: row.id,
				data: null
			})
		]);
		return { saved: true };
	}
};
