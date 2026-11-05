import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { SETTLEMENT_STATUSES } from '#lib/ledger.ts';
import { user } from './auth.schema';

export * from './auth.schema';

// All money is stored as integer poisha (1 taka = 100 poisha).

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

const userRef = (name: string) => text(name).references(() => user.id);

/** Master catalog of breakfast items. Never hard-deleted once used; archive instead. */
export const item = sqliteTable('item', {
	id: id(),
	name: text('name').notNull().default(''),
	unitBn: text('unit_bn').notNull().default('টি'),
	unitEn: text('unit_en').notNull().default('pc'),
	archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
	createdAt: createdAt()
});

export const DAY_STATUSES = ['draft', 'open', 'closed', 'finalized'] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

/** One breakfast day. `date` is YYYY-MM-DD in Asia/Dhaka. */
export const day = sqliteTable(
	'day',
	{
		id: id(),
		date: text('date').notNull(),
		status: text('status', { enum: DAY_STATUSES }).notNull().default('draft'),
		note: text('note'),
		/** Delivery fee for the day (poisha), split equally among everyone who ate. Validated >= 0 in the app. */
		deliveryFee: integer('delivery_fee').notNull().default(0),
		/** Discount for the day (poisha), split equally among everyone who ate. Validated in the app. */
		discount: integer('discount').notNull().default(0),
		createdBy: userRef('created_by').notNull(),
		createdAt: createdAt(),
		finalizedAt: integer('finalized_at', { mode: 'timestamp_ms' }),
		finalizedBy: userRef('finalized_by')
	},
	(t) => [uniqueIndex('day_date_uq').on(t.date)]
);

/** Items offered on a day, with what each cost in total (entered after buying; prices vary by day and shop). */
export const dayItem = sqliteTable(
	'day_item',
	{
		dayId: text('day_id')
			.notNull()
			.references(() => day.id, { onDelete: 'cascade' }),
		itemId: text('item_id')
			.notNull()
			.references(() => item.id),
		/** What this item cost in total today (poisha), split across ordered units at finalize. */
		totalCost: integer('total_cost'),
		available: integer('available', { mode: 'boolean' }).notNull().default(true)
	},
	(t) => [
		primaryKey({ columns: [t.dayId, t.itemId] }),
		check('day_item_cost_nonneg', sql`${t.totalCost} IS NULL OR ${t.totalCost} >= 0`)
	]
);

/** A member's answer to "Aj khaben?" for a day. No row = didn't answer (treated as not eating). */
export const response = sqliteTable(
	'response',
	{
		dayId: text('day_id')
			.notNull()
			.references(() => day.id, { onDelete: 'cascade' }),
		userId: userRef('user_id').notNull(),
		eating: integer('eating', { mode: 'boolean' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date()),
		addedBy: userRef('added_by') // set when a manager adds/edits on someone's behalf
	},
	(t) => [primaryKey({ columns: [t.dayId, t.userId] })]
);

/**
 * Ordered quantity per member per item, in twelfths of an item (12 = 1, 6 = ½, 4 = ⅓; see
 * `#lib/quantity.ts`). `finalQuantity12ths` is what gets charged once finalized.
 */
export const orderLine = sqliteTable(
	'order_line',
	{
		dayId: text('day_id')
			.notNull()
			.references(() => day.id, { onDelete: 'cascade' }),
		userId: userRef('user_id').notNull(),
		itemId: text('item_id')
			.notNull()
			.references(() => item.id),
		quantity12ths: integer('quantity_12ths').notNull(),
		finalQuantity12ths: integer('final_quantity_12ths')
	},
	(t) => [
		primaryKey({ columns: [t.dayId, t.userId, t.itemId] }),
		index('order_line_user_idx').on(t.userId),
		check('order_line_qty_nonneg', sql`${t.quantity12ths} >= 0`),
		check(
			'order_line_final_qty_nonneg',
			sql`${t.finalQuantity12ths} IS NULL OR ${t.finalQuantity12ths} >= 0`
		)
	]
);

/** Who paid the shop for a day's breakfast. Sum must equal the day's total at finalize. */
export const billPayment = sqliteTable(
	'bill_payment',
	{
		id: id(),
		dayId: text('day_id')
			.notNull()
			.references(() => day.id, { onDelete: 'cascade' }),
		userId: userRef('user_id').notNull(),
		amount: integer('amount').notNull() // poisha
	},
	(t) => [
		index('bill_payment_day_idx').on(t.dayId),
		index('bill_payment_user_idx').on(t.userId),
		check('bill_payment_amount_pos', sql`${t.amount} > 0`)
	]
);

/** Member-to-member cash settlement ("A paid B ৳X"). Soft-deleted via voidedAt. */
export const settlement = sqliteTable(
	'settlement',
	{
		id: id(),
		fromUserId: userRef('from_user_id').notNull(),
		toUserId: userRef('to_user_id').notNull(),
		amount: integer('amount').notNull(), // poisha
		date: text('date').notNull(), // YYYY-MM-DD Asia/Dhaka
		note: text('note'),
		/** The receiver's own entry counts at once; anyone else's waits for their approval. */
		status: text('status', { enum: SETTLEMENT_STATUSES }).notNull().default('approved'),
		decidedBy: userRef('decided_by'),
		decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
		rejectReason: text('reject_reason'),
		createdBy: userRef('created_by').notNull(),
		createdAt: createdAt(),
		voidedAt: integer('voided_at', { mode: 'timestamp_ms' }),
		voidedBy: userRef('voided_by')
	},
	(t) => [
		index('settlement_from_idx').on(t.fromUserId),
		index('settlement_to_idx').on(t.toUserId),
		index('settlement_to_status_idx').on(t.toUserId, t.status),
		index('settlement_date_idx').on(t.date),
		check('settlement_amount_pos', sql`${t.amount} > 0`),
		check('settlement_distinct_users', sql`${t.fromUserId} <> ${t.toUserId}`)
	]
);

/** Append-only record of sensitive changes (finalize, reopen, edits after finalize, voids, role changes). */
export const auditLog = sqliteTable(
	'audit_log',
	{
		id: id(),
		actorId: userRef('actor_id').notNull(),
		action: text('action').notNull(), // e.g. 'day.finalize', 'day.reopen', 'settlement.void'
		entity: text('entity').notNull(),
		entityId: text('entity_id').notNull(),
		data: text('data', { mode: 'json' }),
		createdAt: createdAt()
	},
	(t) => [index('audit_entity_idx').on(t.entity, t.entityId)]
);
