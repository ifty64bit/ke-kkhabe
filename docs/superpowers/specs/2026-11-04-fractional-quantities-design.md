# Fractional quantities (sharing an item) — design

Date: 2026-11-04 · Status: approved in chat, pending spec review

## Problem

Two (or three, or four) people often share one item, e.g. one bowl of dal. Quantities are whole
numbers today, so one person has to order the whole bowl and pay for it.

## Goal and success criteria

- Any member can order a fraction of any item: ¼, ⅓, ½, ⅔, ¾, alone or on top of whole units (e.g. 1½).
- Ordering stays a solo action: no partner picking, no confirmation from anyone.
- The purchase summary tells the buyer how many whole items to buy.
- Charges stay exact to the poisha and still add up to the day's total.
- A day with only whole quantities charges exactly what it charges today.

## Non-goals

- Explicitly linking sharers ("share with…"). Rejected for now: new table, partner picker,
  cancellation rules. Can be added later if leftovers become a real problem.
- Per-item opt-in for fractions. Every item allows fractions.
- Arbitrary decimals. Not used, because ⅓ cannot be expressed.

## Data model

The app is unpublished, so the schema changes in place and migrations are regenerated from scratch.

- `order_line.quantity` → `quantity_12ths` (integer, not null, ≥ 0).
- `order_line.final_quantity` → `final_quantity_12ths` (integer, nullable, ≥ 0).
- A value is a count of twelfths of an item: 12 = 1, 6 = ½, 4 = ⅓, 3 = ¼, 8 = ⅔, 9 = ¾.
  Twelve divides evenly by 2, 3, 4 and 6, so every allowed fraction is an exact integer.
  This works the same way money is stored in poisha.
- The upper bound becomes 20 whole items = 240 twelfths.

## Module: `src/lib/quantity.ts`

This is the only place that knows about the 12. It is pure and has no server imports.

- `PORTION = 12`.
- `FRACTIONS = [0, 3, 4, 6, 8, 9]`: the allowed remainders (—, ¼, ⅓, ½, ⅔, ¾).
- `MAX_UNITS = 20 * PORTION`.
- `isValidQty(units)`: an integer from 0 to MAX_UNITS whose `units % PORTION` is in `FRACTIONS`.
- `split(units) → { whole, fraction }` and `join(whole, fraction) → units`.
- `toBuy(units) → whole items`: `Math.ceil(units / PORTION)`.
- `leftover(units) → units`: `toBuy(units) * PORTION - units`.
- `formatQty(units, locale)`: whole digits localized (bn digits in `bn`), plus a vulgar-fraction
  glyph (¼ ⅓ ½ ⅔ ¾). For example 16 → "1⅓", 6 → "½", 24 → "2" (in bn: "১⅓", "½", "২").

Both `MAX_QTY` constants (in `src/lib/server/finalize.ts` and `src/routes/(app)/+page.server.ts`)
are replaced by `isValidQty` / `MAX_UNITS`.

## Money rule (changed)

- **Before:** item cost = price per piece × pieces ordered (final quantities).
- **After:** item cost = price per piece × **whole items bought**, where whole items bought =
  `toBuy(sum of final twelfths for the item)`.
- The cost is split across each eater's final twelfths with the existing `allocate` (largest
  remainder, user-id order). Shares are whole poisha that sum exactly to the item cost.
- Any leftover fraction is therefore paid by that item's eaters in proportion to what they ate.
  Everyone pays the same price per unit eaten.
- Example: three people order ⅓ dal and one orders 1. Ordered = 2⅓, bought = 3, at ৳30 each
  = ৳90. The ⅓ people pay ৳15 each and the person with 1 pays ৳45.
- Delivery fee and discount are unchanged: equal shares among everyone with any positive final quantity.
- `computeBreakdown` in `src/lib/charges.ts` needs no change. It already weights by final quantity
  and now receives twelfths. `validateFinalize` changes: `lineTotal(toBuy(units), price)`
  replaces `lineTotal(units, price)`.

## Screens

All text goes through `useI18n` in both bn and en, built from `src/lib/components/ui`.

- **`QuantityStepper`** gains fractions. Its value is in twelfths, and +/− change the whole part
  by one. A "share / ভাগ" link reveals a chip row (—, ¼, ⅓, ½, ⅔, ¾) that sets the fractional
  part. The row starts open when the value already has a fraction. The output shows `formatQty`.
  The hidden input submits twelfths. Accessible labels: "Add ⅓ {item}" and similar.
- **Today `OrderDialog`** and the **manager's `MemberOrderDialog`** use the new stepper. "Order"
  is enabled when any value is above 0, including a fraction alone.
- **Purchase summary** (manage, closed day): the big number is `toBuy(units)`. When the ordered
  amount is fractional, a muted line below says "{ordered} ordered · {leftover} left over".
- **`FinalizeDialog`**: the same stepper for final quantities. Item totals and the preview use
  whole items bought × price per piece.
- **`Receipt`**, per-person order text on manage, and the ledger/receipt lines show `formatQty`.

## Docs

- `docs/decisions.md`: new entry, "Quantities are twelfths; an item's cost is whole items bought,
  split by what each person ate". It rests on the per-piece price decision.
- `docs/REQUIREMENTS.md`: update the charge rule and the ordering description.

## Testing

- `quantity.test.ts`: `isValidQty` accepts or rejects each case (e.g. 5 and 241 are rejected),
  `split`/`join` round-trip, `toBuy`, `leftover`, `formatQty` in bn and en.
- `finalize.test.ts`: the leftover example above (৳15/৳15/৳15/৳45); a fraction-only item; an
  all-whole day gives the same totals as before (quantities × 12); a fractional final quantity
  that isn't on the allowed list is rejected.
- `charges.test.ts`: existing tests re-expressed in twelfths still pass.
- Server order actions reject invalid twelfths (e.g. 5).
