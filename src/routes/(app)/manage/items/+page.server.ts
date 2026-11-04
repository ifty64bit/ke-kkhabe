import { fail } from '@sveltejs/kit';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import type { MessageKey } from '#lib/i18n/index.ts';
import { requireManager } from '#lib/server/guards.ts';
import { dayItem, item, orderLine } from '#lib/server/db/schema.ts';
import type { Db } from '#lib/server/db/index.ts';
import { unitById } from '#lib/units.ts';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 40;

export const load: PageServerLoad = async ({ locals }) => {
	requireManager(locals);
	const rows = await locals.db
		.select({
			id: item.id,
			nameBn: item.nameBn,
			nameEn: item.nameEn,
			unitBn: item.unitBn,
			unitEn: item.unitEn,
			archived: item.archived,
			usedDays: count(dayItem.dayId)
		})
		.from(item)
		.leftJoin(dayItem, eq(dayItem.itemId, item.id))
		.groupBy(item.id)
		.orderBy(item.nameBn);
	return { items: rows };
};

type Fields = { nameBn: string; nameEn: string; unitId: string };
const fieldsOf = (form: FormData): Fields => ({
	nameBn: String(form.get('nameBn') ?? '').trim(),
	nameEn: String(form.get('nameEn') ?? '').trim(),
	unitId: String(form.get('unit') ?? '')
});

/** Validate and normalize item fields; returns errors keyed by field. */
async function validate(db: Db, f: Fields, exceptId?: string) {
	const errors: Partial<Record<keyof Fields, MessageKey>> = {};
	if (!f.nameBn) errors.nameBn = 'items.error.nameRequired';
	else if (f.nameBn.length > MAX_NAME) errors.nameBn = 'items.error.tooLong';
	if (f.nameEn.length > MAX_NAME) errors.nameEn = 'items.error.tooLong';
	const unit = unitById(f.unitId);
	if (!unit) errors.unitId = 'items.error.unit';

	if (!errors.nameBn) {
		const [dupe] = await db
			.select({ id: item.id })
			.from(item)
			.where(
				and(
					sql`lower(${item.nameBn}) = lower(${f.nameBn})`,
					exceptId ? ne(item.id, exceptId) : undefined
				)
			)
			.limit(1);
		if (dupe) errors.nameBn = 'items.error.duplicate';
	}
	return { errors, unit };
}

const idOf = (form: FormData) => String(form.get('id') ?? '');

export const actions: Actions = {
	create: async ({ locals, request }) => {
		requireManager(locals);
		const f = fieldsOf(await request.formData());
		const { errors, unit } = await validate(locals.db, f);
		if (Object.keys(errors).length || !unit) return fail(400, { errors, values: f });

		await locals.db.insert(item).values({
			nameBn: f.nameBn,
			nameEn: f.nameEn,
			unitBn: unit.bn,
			unitEn: unit.en
		});
		return { saved: true };
	},

	update: async ({ locals, request }) => {
		requireManager(locals);
		const form = await request.formData();
		const id = idOf(form);
		const f = fieldsOf(form);
		const [existing] = await locals.db.select().from(item).where(eq(item.id, id)).limit(1);
		if (!existing) return fail(404, { messageKey: 'items.error.notFound' as MessageKey });

		const { errors, unit } = await validate(locals.db, f, id);
		if (Object.keys(errors).length || !unit) return fail(400, { errors, values: f, id });

		await locals.db
			.update(item)
			.set({ nameBn: f.nameBn, nameEn: f.nameEn, unitBn: unit.bn, unitEn: unit.en })
			.where(eq(item.id, id));
		return { saved: true };
	},

	archive: async ({ locals, request }) => {
		requireManager(locals);
		const id = idOf(await request.formData());
		const res = await locals.db.update(item).set({ archived: true }).where(eq(item.id, id));
		if (!res.meta.changes) return fail(404, { messageKey: 'items.error.notFound' as MessageKey });
		return { saved: true };
	},

	restore: async ({ locals, request }) => {
		requireManager(locals);
		const id = idOf(await request.formData());
		const res = await locals.db.update(item).set({ archived: false }).where(eq(item.id, id));
		if (!res.meta.changes) return fail(404, { messageKey: 'items.error.notFound' as MessageKey });
		return { saved: true };
	},

	/** Hard delete is allowed only for items never offered or ordered; used items are archived. */
	delete: async ({ locals, request }) => {
		requireManager(locals);
		const id = idOf(await request.formData());
		const [[offered], [ordered]] = await Promise.all([
			locals.db.select({ n: count() }).from(dayItem).where(eq(dayItem.itemId, id)),
			locals.db.select({ n: count() }).from(orderLine).where(eq(orderLine.itemId, id))
		]);
		if (offered.n > 0 || ordered.n > 0)
			return fail(409, { messageKey: 'items.error.inUse' as MessageKey });

		const res = await locals.db.delete(item).where(eq(item.id, id));
		if (!res.meta.changes) return fail(404, { messageKey: 'items.error.notFound' as MessageKey });
		return { saved: true };
	}
};
