# Fractional Quantities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone order ¼, ⅓, ½, ⅔ or ¾ of any item (alone or on top of whole units), so people can share one item and each pay their part.

**Architecture:** Quantities become integer twelfths everywhere: in the DB and in the pure charge/finalize math. One pure module, `src/lib/quantity.ts`, owns the 12, validation, buy-count rounding, stepper arithmetic and display. An item's cost becomes price per piece × whole items bought (`toBuy`), split across twelfths by the existing `allocate`.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM on Cloudflare D1 (SQLite), Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-11-04-fractional-quantities-design.md`

## Global Constraints

- Allowed remainders (twelfths): `[0, 3, 4, 6, 8, 9]`, i.e. —, ¼, ⅓, ½, ⅔, ¾. Every item allows them.
- Maximum per line: `MAX_UNITS = 240` (20 whole items). Fractions above 240 are not allowed.
- Money stays integer poisha; quantities stay integer twelfths. No floats in charge math.
- Item cost = `lineTotal(toBuy(units), pricePerPiece)`. Delivery fee and discount rules are unchanged.
- All UI text goes through `useI18n`, with keys in both `src/lib/i18n/en.ts` and `bn.ts`. Build only from `src/lib/components/ui`, using semantic color tokens.
- The schema changes in place. `drizzle/` migrations are regenerated from scratch (the app is unpublished).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Tampered or odd form values** (e.g. `qty:x=5`, `7`, `241`, `250`) posted to the order, member-order or finalize actions must be rejected, not stored. Tests: Task 1 (`isValidQty`), Task 2 (finalize).
2. **A fraction-only order** (½ with 0 wholes = 6) must count as ordering: the submit button is enabled, the server accepts it, and the person counts as an eater for the delivery fee. Test: Task 2 (fee share for a ½-only eater).
3. **Per-piece price derived from a past day** (the manage price suggestion, the today receipt, the finalize price prefill) must divide by whole items bought, not by twelfths. Otherwise it comes out 12× too small. Test: Task 1 (`pricePerPiece`).
4. **Stepper edges:** pressing − on 1½ gives ½, not 0; + is disabled at 20 wholes; a fraction chip is disabled when it would exceed 240. Tests: Task 1 (`stepWhole`, `setFraction`).
5. **Bangla display:** 16 shows as "১⅓" and 6 as "½" (not "০½"). Test: Task 1 (`formatQty`).

---

### Task 1: `quantity.ts`, the pure quantity module

**Files:**
- Create: `src/lib/quantity.ts`
- Test: `src/lib/quantity.test.ts`

**Interfaces:**
- Consumes: `Locale` from `#lib/money.ts`; `formatNumber` from `#lib/i18n/index.ts` (check that importing it doesn't pull in Svelte context; if it does, use `Intl.NumberFormat` with `bn-BD`/`en-BD` directly).
- Produces:
  - `PORTION = 12`
  - `FRACTIONS: readonly number[] = [0, 3, 4, 6, 8, 9]`
  - `MAX_UNITS = 240`
  - `isValidQty(units: number): boolean`
  - `split(units: number): { whole: number; fraction: number }`
  - `join(whole: number, fraction: number): number`
  - `toBuy(units: number): number`: `Math.ceil(units / 12)`
  - `leftover(units: number): number`: `toBuy(units) * 12 - units`
  - `pricePerPiece(totalCost: Poisha, units: number): Poisha`: `Math.round(totalCost / toBuy(units))`, or 0 when `units === 0`
  - `stepWhole(units: number, delta: 1 | -1): number`: changes the whole part, keeps the fraction, clamps the whole to 0..20, and never returns more than `MAX_UNITS` (at 20 wholes the fraction is dropped)
  - `setFraction(units: number, fraction: number): number`: keeps the whole and replaces the fraction; returns `units` unchanged if the result would exceed `MAX_UNITS`
  - `canSetFraction(units: number, fraction: number): boolean`
  - `formatQty(units: number, locale: Locale): string`
  - `FRACTION_GLYPH: Record<number, string>`: `{3:'¼',4:'⅓',6:'½',8:'⅔',9:'¾'}`

- [ ] **Step 1: Write the failing tests** in `src/lib/quantity.test.ts`:
  - `isValidQty`: true for 0, 3, 4, 6, 8, 9, 12, 16, 240; false for 5, 7, 13, 241, 249, -6, 1.5, NaN.
  - `split(16)` → `{ whole: 1, fraction: 4 }`; `join(1, 4)` → 16; round-trips for every valid value from 0 to 240.
  - `toBuy`: 0→0, 4→1, 12→1, 28→3, 36→3. `leftover`: 28→8, 36→0, 0→0.
  - `pricePerPiece(9000, 28)` → 3000; `pricePerPiece(5000, 60)` → 1000; `pricePerPiece(100, 0)` → 0.
  - `stepWhole(18, -1)` → 6; `stepWhole(6, -1)` → 6 (the whole is already 0); `stepWhole(240, 1)` → 240; `stepWhole(234, 1)` → 240; `stepWhole(0, 1)` → 12.
  - `setFraction(12, 6)` → 18; `setFraction(18, 0)` → 12; `setFraction(240, 6)` → 240; `canSetFraction(240, 6)` → false; `canSetFraction(228, 9)` → true.
  - `formatQty`: en 16→"1⅓", 6→"½", 24→"2", 0→"0", 150→"12½"; bn 16→"১⅓", 6→"½", 24→"২".

- [ ] **Step 2: Run** `bunx vitest run src/lib/quantity.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/quantity.ts`** with the signatures above. In `formatQty`, omit the whole digit when it is 0 and there is a fraction.

- [ ] **Step 4: Run** `bunx vitest run src/lib/quantity.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `src/lib/quantity.ts src/lib/quantity.test.ts` with the message "Add quantity module: twelfths, buy count, stepper math, display".

### Task 2: Finalize and charge math in twelfths

**Files:**
- Modify: `src/lib/server/finalize.ts` (remove `MAX_QTY`; quantity check at ~line 90; cost at ~line 110)
- Modify: `src/lib/charges.ts` (doc comments only: weights are twelfths)
- Test: `src/lib/server/finalize.test.ts`, `src/lib/charges.test.ts`

**Interfaces:**
- Consumes: `isValidQty`, `toBuy` from Task 1.
- Produces: `validateFinalize` with unchanged types. `FinalizeLine.quantity` and `FinalizeForm.final[...]` are now twelfths (document this in the comments). `MAX_QTY` is removed; its callers use `isValidQty`.

- [ ] **Step 1: Update the existing tests to twelfths.** In `finalize.test.ts`, multiply every quantity in `ctx.lines` and `form.final` by 12 (2→24, 3→36, 1→12). Expected money values don't change. Do the same in `charges.test.ts`. Then add these new tests:
  - `'charges whole items bought and shares the leftover'`: its own ctx with item `dal` and lines `u1,u2` dal 6 each, `u3` dal 4; price `'30'`; no fee; payment `manager` `'60'`. Expect `costOf(v,'dal') === 6000`, and via `computeCharges` on `v.costs`/`v.final`: u1=u2=2250, u3=1500.
  - `'a fraction-only eater shares the delivery fee'`: its own ctx with u1 paratha 24 and u2 dal 6; prices paratha `'10'`, dal `'30'`; fee `'20'`; payment `'70'`. u1 = 2000 + 1000; u2 = 3000 + 1000.
  - `'rejects quantities that are not an allowed fraction'`: `final[key] = 5` gives error `final:<key>` = `'manage.finalize.error.qtyInvalid'`; same for 241.
- [ ] **Step 2: Run** `bunx vitest run src/lib/server/finalize.test.ts src/lib/charges.test.ts`. Expected: the existing tests now fail on costs (price × 24 instead of × 2), and the new tests fail.
- [ ] **Step 3: Implement.** Replace the integer/`MAX_QTY` check with `isValidQty(qty)`, and compute the cost as `lineTotal(toBuy(n), value)`.
- [ ] **Step 4: Run** `bun run test`. Expected: all suites PASS.
- [ ] **Step 5: Commit** with the message "Finalize: quantities in twelfths; cost is whole items bought".

### Task 3: Schema, regenerated migrations and server code

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`orderLine`)
- Delete and regenerate: `drizzle/*.sql`, `drizzle/meta/*`
- Modify: `src/routes/(app)/+page.server.ts` (`MAX_QTY` at line 11, order action ~138, receipt `unitPrice` ~95)
- Modify: `src/routes/(app)/manage/+page.server.ts` (`unitsExpr` ~98, history subquery ~137, `suggestionOf` ~145, menu-change count ~270, member-order action ~407, finalize write ~516)
- Modify: `src/lib/server/charges.ts`, `src/lib/server/ledger.ts` (column renames)
- Modify: `scripts/reset-orders.ts` if it names the columns

**Interfaces:**
- Consumes: `isValidQty`, `pricePerPiece`, `toBuy` from Task 1.
- Produces: Drizzle props `orderLine.quantity12ths` (column `quantity_12ths`) and `orderLine.finalQuantity12ths` (column `final_quantity_12ths`), keeping the existing nonneg checks. Page data shapes keep their field names (`quantity`, `finalQuantity`, `purchaseUnits`, `units`), whose values are now twelfths. Manage page data adds `purchaseBuy: number` (`toBuy(units)`) per menu item.

- [ ] **Step 1: Rename the columns** in `schema.ts` and update the doc comment ("in twelfths of an item; 12 = 1").
- [ ] **Step 2: Regenerate the migrations.** Run `rm -rf drizzle && bun run db:generate`. Expected: one new `drizzle/0000_*.sql` containing `quantity_12ths`.
- [ ] **Step 3: Update the server code.** Fix every reference to the old props (`bun run check` lists them). Order actions validate with `isValidQty(quantity)` instead of the integer/20 check. The receipt `unitPrice` and `suggestionOf.perUnit` use `pricePerPiece(totalCost, units)`. The suggestion amount becomes `Math.round(perUnit * toBuy(units))`. The raw SQL subquery uses `ol.final_quantity_12ths`.
- [ ] **Step 4: Run** `bun run check && bun run test`. Expected: 0 errors, all tests PASS.
- [ ] **Step 5: Reset the local DB.** Run `rm -rf .wrangler/state/v3/d1 && bun run db:migrate:local && bun run db:seed:local`. Expected: the migration applies with no errors.
- [ ] **Step 6: Commit** with the message "Store order quantities as twelfths; regenerate migrations".

### Task 4: Fraction-aware `QuantityStepper` and the order dialogs

**Files:**
- Modify: `src/lib/components/ui/QuantityStepper.svelte`
- Modify: `src/lib/components/today/OrderDialog.svelte` (the line under the item name uses `formatQty`)
- Modify: `src/lib/components/manage/MemberOrderDialog.svelte`
- Modify: `src/routes/ui/+page.svelte` (showcase: add a stepper with a fractional value)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/bn.ts`

**Interfaces:**
- Consumes: `stepWhole`, `setFraction`, `canSetFraction`, `split`, `formatQty`, `FRACTIONS`, `FRACTION_GLYPH` from Task 1.
- Produces: `QuantityStepper` props unchanged (`value` in twelfths, `name`, `label`, `disabled`, `class`). The `min`/`max` props are removed. The hidden input submits twelfths.

- [ ] **Step 1: Implement the stepper.** − and + call `stepWhole`. − is disabled when the whole is 0; + is disabled when the whole is 20. The output shows `formatQty`. A text link `stepper.share` toggles a chip row for `FRACTIONS`. Each chip is `aria-pressed` when it matches `split(value).fraction`, is disabled when `!canSetFraction`, and has the aria-label `stepper.fraction` `{fraction, label}`. The row starts open when `split(value).fraction > 0`.
- [ ] **Step 2: Add the i18n keys** to both locales. en: `'stepper.share': 'Share'`, `'stepper.fraction': '{fraction} {label}'`, `'stepper.noFraction': 'No share'`. bn: `'stepper.share': 'ভাগ'`, `'stepper.fraction': '{fraction} {label}'`, `'stepper.noFraction': 'ভাগ নেই'`.
- [ ] **Step 3: Update the dialogs.** `OrderDialog` and `MemberOrderDialog` display `formatQty(qty, i18n.locale)`. The submit enable logic (`total > 0`) already works with twelfths.
- [ ] **Step 4: Run** `bun run check && bun run lint`. Expected: clean.
- [ ] **Step 5: Manual check.** Use the `run` skill to order ½ dal plus 2 paratha on Today. Reopen the dialog: it shows ½ with the chip row open, and the saved line reads "½ <unit>".
- [ ] **Step 6: Commit** with the message "Stepper: add fraction chips for sharing an item".

### Task 5: Purchase summary, finalize dialog, receipt and order text

**Files:**
- Modify: `src/routes/(app)/manage/+page.svelte` (`purchaseSummary` ~68, shopping card ~232, `orderText` ~74)
- Modify: `src/lib/components/manage/FinalizeDialog.svelte` (`initialPrices` ~105, `costOf` ~131, stepper ~310)
- Modify: `src/lib/components/today/Receipt.svelte` (line 49 count)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/bn.ts`

**Interfaces:**
- Consumes: `toBuy`, `leftover`, `formatQty`, `pricePerPiece` from Task 1; `purchaseBuy` from Task 3.

- [ ] **Step 1: Shopping card.** The big number is `i18n.num(m.purchaseBuy)`. When `leftover(m.purchaseUnits) > 0`, add a muted line `manage.shopping.ordered` with `{ordered: formatQty(units), leftover: formatQty(leftover(units))}`. en: `'{ordered} ordered · {leftover} left over'`. bn: `'{ordered} অর্ডার · {leftover} বাড়তি'`. `purchaseSummary` uses `purchaseBuy`.
- [ ] **Step 2: Order text.** `orderText` and the receipt count use `formatQty`.
- [ ] **Step 3: Finalize dialog.** The client cost must match the server: `lineTotal(toBuy(n), price)`. `initialPrices` uses `pricePerPiece(m.totalCost, n)`. The stepper needs no change beyond Task 4.
- [ ] **Step 4: Run** `bun run check && bun run lint && bun run test`. Expected: clean, all PASS.
- [ ] **Step 5: Manual check.** Use the `run` skill. Two members order ½ dal and one orders ⅓. Close orders: the shopping card shows "2" and "1⅓ ordered · ⅔ left over". Finalize at ৳30 with a single payer: the charges are ৳22.50/৳22.50/৳15, and the receipt for the ⅓ eater shows "⅓".
- [ ] **Step 6: Commit** with the message "Show buy counts, leftovers and fractional quantities".

### Task 6: Decision record and requirements

**Files:**
- Modify: `docs/decisions.md` (append), `docs/REQUIREMENTS.md` (charge rule at line 51; ordering description)

- [ ] **Step 1: Append to `docs/decisions.md`** in the existing format: "## 2026-11-04 · Quantities are twelfths; an item's cost is whole items bought, split by what each person ate". Decided by: the designer. Why: people share one item (e.g. dal), and the shop charges per whole item. Rejected: half-steps only; explicit "share with…" links; any decimal. Rests on: the per-piece price decision.
- [ ] **Step 2: Update `REQUIREMENTS.md`.** Ordering allows ¼ ⅓ ½ ⅔ ¾ on any item. Charge: item cost = per-piece price × whole items bought (the ordered total rounded up), split by each person's eaten amount.
- [ ] **Step 3: Commit** with the message "Docs: record fractional quantities decision".
