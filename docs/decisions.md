## 2026-11-04 · Navigation is a bottom tab bar on phones and a left rail on desktop

- Decided by: Claude, default
- Why: four destinations used one-handed on phones; a rail uses desktop width without stretching content
- Rejected: hamburger drawer (hides destinations behind a tap for a daily task); top tabs on phone (out of thumb reach)
- Rests on: docs/context-ke-khabe.md (Users), docs/REQUIREMENTS.md (UI: mobile-first)

## 2026-11-04 · Manage is hidden from members rather than shown disabled

- Decided by: Claude, default
- Why: members can never use it; a disabled tab adds noise and invites "why can't I?"
- Rejected: showing it disabled with an explanation
- Rests on: docs/REQUIREMENTS.md (Roles)

## 2026-11-04 · No notifications, streaks or nudges in v1

- Decided by: Claude, default
- Why: once-a-day utility; requirements list notifications as out of scope
- Rejected: morning reminder to order
- Rests on: docs/REQUIREMENTS.md (Out of scope)

## 2026-11-04 · Unbuilt destinations show an empty state, not disabled controls

- Decided by: Claude, default
- Why: the previous home card showed two disabled buttons with no path forward (dead end)
- Rejected: hiding unbuilt destinations until built
- Rests on: review of the `/` placeholder, 2026-11-04

## 2026-11-04 · Today is a single centered prompt with links under it; no sidebar or tab bar

- Decided by: the designer
- Why: the app's daily job is one question; app-style navigation and a card around the question added chrome without purpose
- Rejected: left rail and bottom tab bar (previous default)
- Rests on: designer feedback on the rail layout, 2026-11-04

## 2026-11-04 · Items are picked in a dialog opened from "হ্যাঁ, খাবো"

- Decided by: the designer
- Why: keeps the prompt clean; the picker appears only when the answer is yes
- Rejected: inline item list under the prompt
- Rests on: designer feedback, 2026-11-04

## 2026-11-04 · The egg-pan tile is the brand mark

- Decided by: the designer
- Why: the designer preferred it to the wordmark-only header
- Rejected: wordmark only
- Rests on: designer feedback, 2026-11-04

## 2026-11-04 · A day's price is the item's total cost, split evenly per piece

- Decided by: the designer
- Why: prices change daily, and when a shop runs out an item can come from a second shop at a different price on the same day; the total captures both
- Rejected: one per-piece price chosen by the manager (total may not match what was spent); charging by which shop's piece (manager must assign pieces to people)
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · Days do not record shop names

- Decided by: the designer
- Why: not needed
- Rejected: optional note per day; per-item shop list
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · Items have a single name

- Decided by: the designer
- Why: separate Bangla and English names were unnecessary
- Rejected: required Bangla name with optional English name
- Rests on: designer feedback, 2026-11-04

## 2026-11-04 · The delivery fee is one total per day, split equally among people who ate

- Decided by: the designer
- Why: delivery serves each person once regardless of what they ordered
- Rejected: split by food cost; split by pieces; separate fee per shop or rider
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · The finalize preview and the ledger share one pure charge function

- Decided by: Claude, default
- Why: the client preview must equal `chargesForDay` by construction, not by copying the split math twice
- Rejected: reimplementing the per-item and fee split in the browser
- Rests on: daily-controls prompt §3.6 and §4 (preview is indicative, server result authoritative)

## 2026-11-04 · Form errors travel as message keys plus a param map

- Decided by: Claude, default
- Why: actions must never return locale text, and the payments-mismatch message needs a formatted amount
- Rejected: preformatting amounts inside the pure validator (it stays locale-free and unit-testable)
- Rests on: daily-controls prompt §1 (`fail(status, { messageKey })`), i18n rules

## 2026-11-04 · An eating order with no quantities is rejected in the member-order dialog

- Decided by: Claude, default
- Why: a yes with no items is ambiguous; the dialog already offers "খাবেন না" for skipping
- Rejected: silently saving it as not eating
- Rests on: the Today page's order action, which also requires at least one item

## 2026-11-04 · Unit tests run through a standalone Vitest config

- Decided by: Claude, default
- Why: the tests cover pure modules only, so the app's Vite/SvelteKit pipeline stays untouched
- Rejected: adding a `test` block to vite.config.ts (couples the dev pipeline to tests)
- Rests on: daily-controls prompt §6 (Vitest for `allocate`, `validateFinalize`, the charge preview)

## 2026-11-04 · Settlement rows read "করিম → রহিম ৳৮৫", never a case-suffixed name

- Decided by: Claude, default
- Why: Bangla case endings can't be built onto arbitrary names (an English name would break the grammar); the ledger prompt's i18n rule says names should stand alone
- Rejected: "করিম রহিমকে দিয়েছেন ৳৮৫" (suffixes an ending onto any given name)
- Rests on: ledger prompt §3.4 vs §4 (the i18n rule wins over the example copy)

## 2026-11-04 · The over-amount warning compares against the suggested transfer for that pair

- Decided by: Claude, default
- Why: balances hold no pairwise debt, so the settle-up suggestion is the closest computable "current debt or credit"; it stays a soft warning either way
- Rejected: rejecting the submit (the spec forbids it); comparing against the payer's whole balance (wrong axis)
- Rests on: ledger prompt §2 (record validation: never reject, do warn)

## 2026-11-04 · The 30-day settlement window cuts on the Dhaka date, computed in the app

- Decided by: Claude, default
- Why: SQLite `date('now')` is UTC and would clip the boundary wrong after 18:00 BST; the stored `settlement.date` is the Dhaka date key anyway
- Rejected: `date('now', '-30 days')` in SQL
- Rests on: ledger prompt §3.4 (recent settlements, last 30 days), Asia/Dhaka day boundary

## 2026-11-04 · `balancesFrom` also drops rows whose day is not finalized

- Decided by: Claude, default
- Why: a reopened day must vanish from balances; doing it in the pure fold as well as the SQL join makes it unit-testable and keeps `computeLedger` honest
- Rejected: trusting the SQL join alone
- Rests on: ledger prompt §2 (only finalized days count), §6 (unit tests without a database)

## 2026-11-04 · The manager enters a price per piece; totals and shares are calculated

- Decided by: the designer
- Why: the manager knows per-piece prices; asking for item totals was a misreading of the mixed-shop answer
- Rejected: a total cost per item as the input
- Rests on: designer feedback on the finalize form, 2026-11-04

## 2026-11-04 · A day's discount is one amount, taken off equally among everyone who ate

- Decided by: the designer
- Why: same rule as the delivery fee
- Rejected: in proportion to each person's food cost; per item by lowering its price
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · Finalizing is blocked when the discount would make anyone's charge negative

- Decided by: Claude, default
- Why: an equal discount share can exceed a small order; a negative charge would pay that person out of the others' money
- Rejected: allowing negative charges; capping each person's discount silently
- Rests on: equal-split rule above

## 2026-11-04 · Each item has one per-piece price per day; no mixed-shop total mode

- Decided by: the designer
- Why: breakfast always comes from a single shop
- Rejected: a per-item total mode for an item bought from two shops at different prices
- Rests on: designer feedback, 2026-11-04 (supersedes the earlier mixed-shop split answer)

## 2026-11-04 · Quantities are twelfths; an item's cost is whole items bought, split by what each person ate

- Decided by: the designer
- Why: people share one item (e.g. a bowl of dal), and the shop charges per whole item. Twelfths make ¼, ⅓, ½, ⅔ and ¾ exact integers, like poisha for money
- Rejected: half-steps only; explicit "share with…" links between members; any decimal (cannot express ⅓); per-item opt-in for fractions
- Rests on: per-piece price decision above; designer answers, 2026-11-04

## 2026-11-05 · Only halves for now; an unclaimed half becomes a whole for whoever ordered a half last

- Decided by: the designer
- Why: with mixed fractions (½ + ⅓ leaves ⅙) there is no clear rule for who pays an unclaimed part; with halves only, the person who left the half open pays for it. Others see the open half when they order, and closing orders warns with names
- Rejected: hard-blocking an order until it is matched (the first sharer is always unmatched); hard-blocking close (breakfast has a deadline); splitting the leftover across all eaters
- Rests on: twelfths decision above (storage and math still support ¼, ⅓, ⅔, ¾; see the FUTURE note on `FRACTIONS` in `src/lib/quantity.ts`)
