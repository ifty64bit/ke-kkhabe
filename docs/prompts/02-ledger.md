# Task: build the ledger (হিসাব)

You are working in **Ke Khabe**, an office breakfast ordering app with a shared due ledger. Managers now finalize each day with real costs and who paid the shop (see `/manage`). This task builds the page that answers the question the app exists for: **who owes whom, and how do we settle up?**

Before writing code, read:

- `docs/REQUIREMENTS.md` (sections "Money and ledger" and "Reports")
- `docs/decisions.md`
- `docs/prompts/01-daily-controls.md`, **section 1 only**. Its project conventions apply here unchanged: SvelteKit 3 specifics, `requireManager`, `db.batch`, poisha-only money, i18n rules, UI primitives, semantic tokens, the `$effect.pre` dialog pattern.

Do not push, deploy, or run anything with `--remote`. Work only against the local D1 database.

---

## 1. What already exists (reuse it, don't rewrite it)

- **Charge math:**
  - `computeCharges(items, lines, deliveryFee)` in `src/lib/charges.ts` is pure and browser-safe: each item's total cost is split across final quantities, and the delivery fee equally among eaters, exact to the poisha.
  - `chargesForDay(db, dayId)` in `src/lib/server/charges.ts` runs it for one day.
- **Money:** `parseTaka`, `formatTaka`, `allocate`, `sum` in `src/lib/money.ts`. An empty taka field means 0 wherever 0 is allowed. The client and server must apply the same rule; this was a real bug in the last task.
- **Tests:** Vitest is set up (`bun run test`, `vitest.config.ts`, tests in `src/**/*.test.ts`, `#lib` alias). Add tests next to the modules you create.
- **Settlement table** (already in the schema; no migration is needed):
  ```
  settlement  id, fromUserId, toUserId, amount (poisha, > 0, CHECK), date (YYYY-MM-DD, Asia/Dhaka),
              note, createdBy, createdAt, voidedAt, voidedBy     -- CHECK fromUserId <> toUserId
  ```
- **Other tables used:**
  - `day` (`status`, `date`, `deliveryFee`), `day_item` (`totalCost`), `order_line` (`finalQuantity`).
  - `bill_payment` (`dayId`, `userId`, `amount`): who paid the shop.
  - `user` (`name`, `image`, `role`, `active`), `audit_log`.
- **The page shell** `src/routes/(app)/ledger/+page.svelte` exists, showing an empty state, inside the signed-in layout. The Today page's link row already links here. Strings `ledger.title`, `ledger.description`, `ledger.emptyTitle` and `ledger.emptyBody` exist in `bn.ts` and `en.ts`.

## 2. The rules

### Balance

For every user:

```
balance = Σ bill_payment.amount   (on FINALIZED days)        -- they paid the shop
        + Σ settlement.amount where fromUserId = user  (not voided)   -- they paid someone back
        − Σ charge                (on FINALIZED days, from computeCharges)
        − Σ settlement.amount where toUserId = user    (not voided)   -- they were paid back
```

- **Positive** means others owe them. **Negative** means they owe.
- **Only finalized days count.** A reopened day keeps its `bill_payment` rows, but they must not count until it's finalized again. The same goes for charges.
- **Voided settlements never count.**
- **Invariant:** the sum of all balances is exactly 0. Test it.
- Include every user with a non-zero balance, **including deactivated users**: they may still owe or be owed. Show them with a "নিষ্ক্রিয়" badge. Active users with a zero balance are shown too (as settled); inactive users with zero are hidden.

### Computing it efficiently

Don't call `chargesForDay` once per day; that's N queries and grows forever. Instead, put **`computeLedger`** in `src/lib/server/ledger.ts`:

1. Load, in parallel and once each:
   - finalized days (`id`, `deliveryFee`, `date`)
   - all `day_item` rows of finalized days (`dayId`, `itemId`, `totalCost`)
   - all `order_line` rows of finalized days (`dayId`, `userId`, `itemId`, `finalQuantity`)
   - all `bill_payment` rows of finalized days
   - all non-voided settlements
   - users
2. Group by day in memory, run `computeCharges` per day, and fold everything into balances.

Keep the folding in a **pure function**, e.g. `balancesFrom({ days, items, lines, payments, settlements })` in `src/lib/ledger.ts`, so it's unit-testable without a database.

### Settle-up suggestions

`suggestSettlements(balances)`, pure, in `src/lib/ledger.ts`. It returns transfers `{ from, to, amount }` that bring every balance to zero:

- Greedy: repeatedly match the largest debtor with the largest creditor, transfer `min(|debt|, credit)`, and repeat until all balances are zero.
- Break ties by user id so the result is stable.
- Integer poisha only.
- This doesn't guarantee the mathematical minimum (that's NP-hard), and it doesn't need to. It never produces more than _n − 1_ transfers for _n_ non-zero balances. Test that.
- Suggestions are only suggestions. **Balances change only when a settlement is recorded.**

### Recording a settlement ("A paid B ৳X")

Action `record`. Input: `from`, `to`, `amount` (taka string, parsed with `parseTaka`, > 0), optional `note` (trimmed, ≤ 100 characters), optional `date` (YYYY-MM-DD, not after `dhakaToday()`, defaults to today).

**Who may record:**

- The payer (`from`), the receiver (`to`), or any manager.
- Members can't record settlements between two other people. Return `fail(403, { messageKey })`.

**Validation:**

- `from ≠ to`, and both are existing users. Deactivated users are allowed, since they may be settling their debt.
- The amount is a valid positive taka value.
- **Don't** reject an amount larger than the balance: people sometimes pay in advance. Do show a soft warning in the dialog when it exceeds the current debt or credit.

Insert with `createdBy: me`. No audit row is needed for creation: the row is the record, and `createdBy` says who.

### Voiding a settlement

Action `void`. Input: `id`.

- **Who:** whoever created it, or any manager.
- Set `voidedAt: now` and `voidedBy: me`, and write audit `settlement.void` with `{ from, to, amount, date }`, in one `db.batch`.
- An already-voided settlement returns `fail(409)`.
- Never delete settlement rows.

## 3. Screen (`src/routes/(app)/ledger/+page.svelte` + `+page.server.ts`)

Visible to **every** signed-in user (the team chose transparency). Mobile-first, one column, using the existing primitives and the halkhata look. Keep it calm: this is money, not a dashboard.

1. **Your balance first**, as the page's one bold element, under the PageHeader. One plain sentence with the amount:
   - "আপনি পাবেন ৳১২০" (green)
   - "আপনার দেওয়ার আছে ৳৮৫" (red)
   - "আপনার হিসাব মেলানো" (neutral)

   Use `Money` with `balance`. Under it, if you owe, show the suggested transfers that involve you ("রহিমকে ৳৮৫ দিন"), each with a button "দিয়ে দিয়েছি" that opens the record dialog **pre-filled** (from you, to them, that amount).

2. **Everyone's balance:** a list of Avatar, name, and signed `Money`. Sort owed-most first, then settled, then owes-most. "আপনি", "নিষ্ক্রিয়" and "ম্যানেজার" badges as on the members page.
3. **Settle-up suggestions** for the whole team: "সবচেয়ে কম লেনদেনে মেটাতে". Each row reads "করিম → রহিম ৳৮৫". The record button shows only where the viewer may record it (a party, or a manager).
4. **Recent settlements**, newest first, last 30 days, non-voided. Each row: "করিম রহিমকে দিয়েছেন ৳৮৫", date, note, and "লিখেছেন …" when the recorder isn't a party. A row menu offers "বাতিল করুন" (void) for the creator or a manager. It opens a confirm Dialog that names the amount and both people, and explains the entry will stop counting but stay in history.
5. A secondary button **"পেমেন্ট লিখুন"** opens the record dialog empty:
   - From and To Selects. For a member, one side is fixed to themselves; offer "আমি দিয়েছি" / "আমাকে দিয়েছে" with a SegmentedControl. Managers can pick both.
   - Amount, optional note, and a date that defaults to today.
6. **Empty state** when no day has ever been finalized: keep the existing copy.

**Dialogs:** every confirm or record dialog **closes on success** and shows its errors **inside** the dialog. Both were real bugs in the last task. Page data refreshes after success (`update()` in `enhance`).

**Today page:** under the prompt's link row, the "হিসাব" hint currently says "কার কাছে কত বাকি". Replace it with the viewer's own balance in short form ("পাবেন ৳১২০" / "দেবেন ৳৮৫" / "মেলানো"). Compute it with the same `computeLedger`, and only on the server.

## 4. i18n

Add every string to `src/lib/i18n/bn.ts` and `en.ts`, Bangla first, short and plain, active voice:

- Debt is a neutral fact. **No shaming, no urgency** ("দেওয়ার আছে", never "বকেয়া! এখনই দিন").
- Use `i18n.num` for counts and `Money` (or `formatTaka`) for amounts.
- Bangla possessive and object forms need care when inserting names ("রহিমকে", "রহিমের"). Prefer sentence shapes where the name stands alone, e.g. "রহিম → করিম ৳৮৫" or "পাবেন: রহিম", instead of building case endings onto arbitrary names.

## 5. Edge cases

- A day reopened after settlements were recorded: balances drop that day until it's finalized again. Settlements still count. Balances can go positive temporarily; that's correct.
- A settlement involving a deactivated user: allowed, and shown with the badge.
- Two people record the same payment: both entries count. Voiding is the fix, and the recent list must make duplicates easy to spot (same people, amount and date next to each other).
- Large numbers: balances over ৳1,00,000 must format correctly in both locales. Bangla uses lakh grouping via `Intl` `bn-BD`; check it.
- A member who has never eaten and never paid: balance 0, shown as settled.

## 6. Tests

Unit (Vitest):

- `balancesFrom`: a hand-worked example with two finalized days, a reopened day (must be ignored), a delivery fee, two payers on one day, a settlement, and a voided settlement (must be ignored). Assert exact balances and that their sum is 0.
- `suggestSettlements`: all-zero gives none; one debtor and one creditor; many-to-many; ties stable; never more than n − 1 transfers; applying the transfers brings every balance to exactly 0; a fuzz loop over random integer balances that sum to 0.
- The record and void permission rules, if you extract them into a pure function (recommended).

Against **local** D1, using the `getPlatformProxy` script pattern from the last task. Snapshot `.wrangler/state/v3/d1` first and restore it afterwards:

- Create two finalized days with several users, record settlements as a member (allowed for own, 403 for others) and as a manager, void one, and check balances and the audit row.
- Reopen a day and check balances exclude it.
- Remove every test user and row afterwards. The local DB has one real user (a manager) and an open day `seed-day-2026-11-04`.

Browser: phone width and desktop, both languages. Record, pre-fill from a suggestion, void, the duplicate scenario, and the empty state.

## 7. Acceptance criteria

- [ ] `/ledger` shows the viewer's balance, everyone's balances, settle-up suggestions and recent settlements, for every signed-in user.
- [ ] Balances count only finalized days and non-voided settlements, and always sum to exactly 0 poisha.
- [ ] Members can record settlements they're part of; managers can record any. Creators and managers can void. Every void writes an audit row. Nothing is deleted.
- [ ] Suggestions settle everyone exactly, use at most n − 1 transfers, and are stable.
- [ ] The Today page link shows the viewer's own short balance.
- [ ] Dialogs close on success and show errors inside; client and server agree on every amount rule.
- [ ] All strings in `bn.ts` and `en.ts`; English mode reads correctly; amounts use `Money`.
- [ ] `bun run check` shows 0 errors and 0 warnings, `bun run lint` has no errors, and `bun run test` passes.
- [ ] Decisions you made yourself are appended to `docs/decisions.md` in its format. `docs/REQUIREMENTS.md` still matches.

## 8. Out of scope

Monthly reports and CSV export (next task), online payments (bKash/Nagad), notifications or reminders, editing settlements (void and re-record instead), schema changes, and anything touching production.
