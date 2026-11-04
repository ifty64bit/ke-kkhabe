# Task: build the manager's daily controls (ম্যানেজ → আজকের দিন)

You are working in **Ke Khabe**, an office breakfast ordering app with a shared due ledger. Read `docs/REQUIREMENTS.md`, `docs/ia-ke-khabe.md` and `docs/decisions.md` before writing code. This task builds the screen where a manager runs today's breakfast: post the menu, open and close orders, see what to buy, add late orders, and finalize the day with real costs and who paid. Until this exists, days can only be created by hand in the database.

Do not push, deploy, or run anything with `--remote`. Work only against the local D1 database.

---

## 1. Stack and project conventions (follow exactly)

- **SvelteKit 3** (Svelte 5 runes) on Cloudflare Workers, **Drizzle ORM** on **Cloudflare D1** (SQLite), **Better Auth** (Google), **Tailwind CSS v4**, Bun.
- Commands: `bun run check` (types), `bun run lint` (Prettier + ESLint; 2 warnings in the generated `worker-configuration.d.ts` are expected), `bunx prettier --write src`, `bun run dev`.
- **SvelteKit 3 specifics:**
  - `resolve()` from `$app/paths` takes **route IDs**, e.g. `resolve('/(app)/manage')`, not `'/manage'`.
  - Env flags come from `$app/env` (`dev`, `building`); private env from `$app/env/private`.
  - Errors thrown inside `hooks.server.ts` skip `+error.svelte`. Throw `error()` from load functions instead.
  - Form actions run **before** layout loads, so every action must check permissions itself.
- **Auth/permissions:** `src/lib/server/guards.ts` exports `requireManager(locals)`. It throws 403 unless the user is a manager and returns the user. Call it at the top of the `load` **and every action** in this feature. `/manage/*` page views are also guarded by `src/routes/(app)/manage/+layout.server.ts`.
- **Database access:** `locals.db` (Drizzle, typed schema in `src/lib/server/db/schema.ts`). Use `db.batch([...])` for multi-statement writes so they are atomic. D1 has no interactive transactions.
- **Money:** always integer **poisha** (1 taka = 100 poisha). Helpers in `src/lib/money.ts`:
  - `parseTaka(input)` turns "160", "১৬০", "1,250.50" or "৳30" into poisha, or `null` if invalid.
  - `formatTaka(poisha, locale)` formats for display.
  - `allocate(total, weights)` splits exactly (largest remainder). It throws if `total > 0` and all weights are 0.
  - `sum(values)`.
  - Never do arithmetic on taka floats.
- **Charges:** `src/lib/server/charges.ts` exports `chargesForDay(db, dayId)`, which returns `Map<userId, poisha>`. It splits each item's `totalCost` across final quantities, then splits `day.deliveryFee` equally among everyone who ate. Use it for the finalize preview and the finalized summary. Don't reimplement the math.
- **Dates:** `dhakaToday()` from `src/lib/date.ts` returns today's `YYYY-MM-DD` in Asia/Dhaka. `day.date` is that key and is unique.
- **i18n:** all UI text goes through `useI18n()` from `#lib/i18n/index.ts`:
  - `i18n.t(key, params)` for text, `i18n.num(n)` for Bangla or English digits, `i18n.day(date)`, `i18n.date(ts)`, and `i18n.pick(bn, en)` for bilingual DB fields such as units.
  - Add every new string to `src/lib/i18n/bn.ts` and `src/lib/i18n/en.ts`. `en.ts` is typed against `bn.ts`, so a missing key fails `bun run check`.
  - **Never hard-code Bangla or English in components.** Server actions return `fail(status, { messageKey })` or per-field `errors: Record<field, MessageKey>`, never text.
  - Write Bangla first. It's the default language and the users' first language. Keep copy short, plain and in active voice.
- **UI primitives:** build only from `#lib/components/ui/index.ts`: Alert, Avatar, Badge (tones: `neutral | highlight | success | warning | danger`), Button (variants `primary | secondary | ghost | danger | link`, `loading`, `href`), Card (title, description, actions and footer snippets, `padding`), Dialog (`bind:open`, title, description, footer snippet receiving `{ close }`; bottom sheet on phones), EmptyState, Field (label, hint, error; children snippet receives ids to spread onto the control), IconButton, Input, Menu/MenuItem/MenuLabel/Separator, Money (`balance` prop for signed colour), PageHeader, QuantityStepper (`bind:value`, `name`, `label`), SegmentedControl, Select, Skeleton, Spinner, Textarea.
  - If you need a new primitive, add it to `src/lib/components/ui/` and export it from `index.ts`.
- **Styling:** semantic tokens only (`bg-surface`, `bg-surface-2`, `text-fg`, `text-muted`, `border-border`, `bg-primary`, `bg-haldi-soft`, `text-danger`, `bg-success-soft`, and so on). No raw colours and no `dark:` in pages.
  - Turmeric (`haldi`) is reserved for the "open today" status.
  - Shadows only on floating layers.
  - The look is "halkhata" (the Bangladeshi red ledger book). Keep pages calm. The manage section already has a `PageHeader` and tabs in `manage/+layout.svelte`.
- **Forms:** use `use:enhance` from `$app/forms`.
  - **Dialog bug to avoid:** when a dialog contains controls bound to state, initialize that state with `$effect.pre` (not `$effect`), and give it a value at creation. Otherwise `bind:value` gets `undefined` on first open and Svelte throws `props_invalid_value`. See `src/lib/components/today/OrderDialog.svelte` for the working pattern.
- **Existing patterns to copy:**
  - `src/routes/(app)/manage/items/` (load, actions with per-field errors, row menus, confirm dialog).
  - `src/routes/(app)/manage/members/` (guards, audit log writes in `db.batch`).
  - `src/routes/(app)/+page.server.ts` (Today page: how a day, its items, responses and order lines are read; the `order` and `skip` actions; the open-day precondition).

## 2. Data model (already exists; no migration should be needed)

```
day         id, date (YYYY-MM-DD, unique), status: 'draft'|'open'|'closed'|'finalized',
            note, deliveryFee (poisha, default 0), createdBy, createdAt, finalizedAt, finalizedBy
day_item    (dayId, itemId) PK, totalCost (poisha, nullable until finalized), available (bool)
response    (dayId, userId) PK, eating (bool), updatedAt, addedBy (manager who edited on their behalf)
order_line  (dayId, userId, itemId) PK, quantity (what they asked for), finalQuantity (what they got; null until finalize)
bill_payment id, dayId, userId, amount (poisha, > 0)   -- who paid the shop
audit_log   id, actorId, action, entity, entityId, data (json), createdAt
item        id, name (single name), unitBn, unitEn, archived
user        id, name, email, image, role ('member'|'manager'), active (bool)
```

If you find you truly need a schema change, stop and explain why first. Drizzle-kit generates a broken data-copy statement when it rebuilds a SQLite table (it selects the new column from the old table). Any generated migration that contains `__new_` must be hand-checked.

## 3. Behaviour

Scope: **today only** (`dhakaToday()`). Past days are out of scope.

### State machine

```
(no day) --start--> open --close--> closed --finalize--> finalized
                      ^               |  ^                   |
                      +---reopen------+  +------reopen-------+
```

`draft` exists in the schema. Members' Today page treats `draft` like "no menu yet". This task creates days directly as `open`. Keep `draft` handling in reads, but no UI needs to produce it.

### Actions (all in `src/routes/(app)/manage/+page.server.ts`, all call `requireManager`)

1. **`start`** (no day exists for today)
   - Input: `itemId[]`, at least one, from non-archived items.
   - Insert the `day` (`status: 'open'`, `createdBy: me`) and its `day_item` rows (`available: true`) in one batch.
   - If a day already exists for today (a race with another manager), return `fail(409, { messageKey })`.
2. **`setItems`** (status `open` or `closed`)
   - Add items to today's menu: insert missing `day_item` rows (only non-archived items).
   - Toggle availability: set `available` true or false. Don't delete `day_item` rows.
   - If an item being made unavailable already has orders (`order_line.quantity > 0`), still allow it, but return/show a warning count. At finalize those lines default to final quantity 0.
3. **`close`** (`open` → `closed`)
   - Set the status, and write the audit entry `day.close` with `{ yes, no, noAnswer }` counts.
   - Members who never answered count as not eating. Don't create rows for them.
4. **`reopenOrders`** (`closed` → `open`): audit `day.reopen_orders`.
5. **`saveMemberOrder`** (status `open` or `closed`): the manager adds or edits a member's order for a late request.
   - Input: `userId` (an active user), `qty:<itemId>` fields (integers 0–20, only for available items on today's menu), and optionally `eating=false` to mark them as not eating.
   - Same write shape as the Today page's `order` and `skip` actions: upsert `response` (set `addedBy: me`), then replace that member's `order_line` rows.
   - Audit `order.manager_edit` with `{ userId, lines }`.
6. **`finalize`** (`closed` → `finalized`). Input fields:
   - `cost:<itemId>`: taka string for every item on today's menu, parsed with `parseTaka`. Empty means 0.
   - `final:<userId>:<itemId>`: final quantity for every existing order line, integer 0–20. Defaults in the form to `quantity`, or 0 if the item is unavailable.
   - `deliveryFee`: taka string; empty means 0.
   - `payer:<n>` / `paid:<n>` pairs: who paid the shop and how much. Payers must be active users; amounts > 0; the same payer can't appear twice.

   **Validation.** Return per-field `errors` and do nothing if any fail:
   - Every amount parses, and is ≥ 0 (> 0 for payments).
   - An item with **0 total final units must have cost 0**, because a cost can't be split over nobody (`allocate` throws). Error on that item's cost field.
   - If `deliveryFee > 0`, at least one member must have eaten something.
   - At least one payment row when the grand total is > 0.
   - **Sum of payments must equal the sum of item costs plus the delivery fee**, exactly in poisha. The error says how much is missing or extra.
   - Extract this validation into a **pure function**, e.g. `src/lib/server/finalize.ts` → `validateFinalize(input, context)`, so it's unit-testable without a database.

   **Write, in one `db.batch`:**
   - `day_item.totalCost` for each item, and `order_line.finalQuantity` for each line.
   - `day.deliveryFee`, `status: 'finalized'`, `finalizedAt: now`, `finalizedBy: me`.
   - Delete existing `bill_payment` rows for the day, then insert the new ones.
   - Audit `day.finalize` with the totals.

7. **`reopenDay`** (`finalized` → `closed`)
   - Keep `totalCost`, `finalQuantity`, `deliveryFee` and `bill_payment` rows as they are, so the finalize form re-opens pre-filled.
   - Clear `finalizedAt` and `finalizedBy`. Audit `day.reopen` with the previous totals.
   - Note for the future ledger: only finalized days count, so reopening removes that day from balances until it's finalized again.

Every action re-reads the day for today and checks its status first. Return `fail(409, { messageKey })` for a wrong status, never a crash.

### Load (`+page.server.ts`)

Return everything the current state needs, in one load:

- Today's date, the day (or null), and today's menu items with name, units, `available`, `totalCost`.
- All non-archived items (for `start` and `setItems`).
- Active members (id, name, image).
- Each member's response and order lines.
- Counts: yes / no / no answer, among active members.
- **Purchase totals per item**: sum of `quantity` for `open`/`closed`, and of `finalQuantity` when finalized.
- When closed or finalized: existing `bill_payment` rows.
- When finalized: `chargesForDay` results and the grand total.
- **Cost suggestion per item** (for the finalize form): take the most recent _finalized_ day that offered this item with units > 0, compute its per-unit cost (`totalCost / units`), multiply by today's units, round to whole poisha, and pre-fill the field with that. Also return the per-unit figure for a hint ("গতবার প্রতি পিস ৳১০.৬৭"). With no history, leave the field empty.

## 4. Screen (`src/routes/(app)/manage/+page.svelte`)

Mobile-first, one main card at a time, chosen by state. Reuse the existing manage layout (PageHeader "ম্যানেজ" and tabs).

- **No day yet:** a short line ("আজকের দিন এখনো শুরু হয়নি") and a checklist of non-archived items, with checkboxes. Default the selection to the items on the most recent day, if any. One primary button, "অর্ডার নেওয়া শুরু করুন". If there are no items at all, show an EmptyState that links to the items tab.
- **Open:**
  - A status line with a `highlight` Badge ("অর্ডার চলছে") and counts: "৯ জন খাবেন, ২ জন খাবেন না, ৩ জন উত্তর দেননি".
  - Live purchase totals so far, e.g. "পরোটা ২৩ টি, ডিম ভাজি ১২ টি".
  - A people list: who ordered what, who said no, who hasn't answered (names only). Each row has an action that opens a member-order dialog: the same QuantityStepper pattern as `OrderDialog`, plus "খাবেন না".
  - A "মেনু বদলান" dialog for `setItems`.
  - The primary action is "অর্ডার বন্ধ করুন". It opens a confirm Dialog showing the counts and states that people who haven't answered will be counted as not eating.
- **Closed:**
  - The **shopping list** first, as a clear list of item and total quantity. This is what the manager reads at the shop counter, so make it large and easy to read.
  - The people list again, still editable for late requests.
  - Secondary actions: "আবার অর্ডার খুলুন" and "মেনু বদলান". Primary: "হিসাব চূড়ান্ত করুন", which opens the finalize form.
- **Finalize form:** a full-height Dialog on phones, or the page section itself. Show:
  - Per item: name, total units, and a taka Input for total cost (pre-filled from the suggestion, with the per-unit hint under it). Use `inputmode="decimal"`.
  - Per member: a collapsible list of their lines with QuantityStepper for final quantity, for when the shop ran out.
  - Delivery fee input.
  - Payments: rows of member Select plus amount Input, with "আরেকজন যোগ করুন" to add a row. Default to one row with the manager and the full total.
  - A sticky summary: items total, plus delivery, equals grand total; paid; and "বাকি ৳…" or "বেশি ৳…" until it matches (use `danger` text until it does).
  - A **preview** of each member's charge, computed on the client with the same rules. Import `allocate` from `#lib/money.ts`, which is pure and safe in the browser. The server result after saving is authoritative.
  - Submit "চূড়ান্ত করুন", disabled until payments match.
- **Finalized:** a summary card with a `success` Badge ("চূড়ান্ত"):
  - Grand total, who paid what, and each member's charge, using `Money`.
  - A secondary "আবার খুলুন" opens a confirm Dialog explaining that the day leaves the balances until it's finalized again.

Every list renders names with `Avatar` plus name. Use `i18n.num` for counts and quantities, and `Money` for amounts. After each successful action the page data refreshes (`update()` in `enhance`), and dialogs close.

Also update the members' **Today page** only where needed: it already handles `open`, `closed` and `finalized` (showing the charge via `chargesForDay`). Check it still reads correctly after real days exist, and that unavailable items don't appear in the order dialog. They're already filtered by `available`.

## 5. Edge cases to handle

- Two managers acting at once: every action re-checks status. `start` handles the unique date (catch the constraint error and return 409).
- A member deactivated after ordering: keep their lines and charge them normally. Exclude them from "no answer" counts, and from the payer Select unless they're already a payer.
- An item made unavailable after orders: its lines default to final 0 in the finalize form. The manager can still set a quantity if it turned up after all.
- Everyone skipped: finalize with zero costs and no payments is allowed when the grand total is 0.
- Rounding: never round per member yourself. Always go through `allocate` or `chargesForDay`, so totals match exactly.
- Language: switch to English (header button) and check every new string, digit and amount.

## 6. Tests

There is no test runner yet. Add **Vitest** (check its current docs for SvelteKit and Vite 8 setup) with a `bun run test` script, and write unit tests for:

- `allocate` in `src/lib/money.ts`: exact sums, zero weights, odd poisha, throws on cost over zero units.
- `validateFinalize`: every rule in section 3.6, including the payment-mismatch amounts.
- The client-side charge preview function, if you extract one: it must equal `chargesForDay` for the same inputs.

Then exercise the server actions against **local** D1. A pattern that works: a Bun script using `getPlatformProxy` from `wrangler` with `{ configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' } }`, building `getDb(env.DB)` and calling the exported `actions.x({ locals: { db, user }, request })` directly.

- Modules importing `$app/env/private` need a Bun preload plugin that maps it to `process.env`.
- Restore any data you change. The local DB has one real user account (a manager), 8 items, and an old seeded day with id `seed-day-2026-11-04` that may not be today. To test the "no day yet" state, use a date with no day; don't delete the user's data.
- Don't leave test users or audit rows behind.

Finally, test in the browser at phone width and at desktop width, in both Bangla and English. Don't leave the user's local account changed: role `manager`, `active`.

## 7. Acceptance criteria

- [ ] A manager can start today, take orders, close, see the shopping list, add a late order, finalize with costs, delivery fee and one or several payers, and reopen, all from `/manage`.
- [ ] Members see the right state on their Today page at every step, including their exact charge after finalize.
- [ ] Payments must equal costs plus delivery to the poisha before finalize is allowed. The sum of `chargesForDay` equals that same total.
- [ ] Item costs on items nobody ate are rejected unless 0; a delivery fee with no eaters is rejected.
- [ ] Every state change and manager edit writes an `audit_log` row.
- [ ] Members get 403 on the page and on every action.
- [ ] All text is in `bn.ts` and `en.ts`; no hard-coded strings; English mode reads correctly.
- [ ] Only existing primitives and semantic tokens are used (or new primitives added to the ui kit).
- [ ] `bun run check` shows 0 errors and 0 warnings, `bun run lint` has no errors, and `bun run test` passes.
- [ ] `docs/REQUIREMENTS.md` still matches the behaviour; any decision you had to make yourself is appended to `docs/decisions.md` in its existing format.

## 8. Out of scope

The ledger page (balances, settle-up), reports, CSV export, editing past days, notifications, schema changes, and anything touching production.
