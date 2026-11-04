# Ke Khabe: Requirements (v1)

Office breakfast ordering with a shared expense ledger. Each working day, members answer **"Aj khaben?"** by picking items. A member buys the food, the manager enters the actual prices and who paid, and everyone's balance updates. Members can see who owes whom.

## Roles

| Role        | Can do                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Member**  | Order for today, edit or cancel while ordering is open, view the ledger and reports for everyone, log settlements                                |
| **Manager** | Everything a member can, plus: manage the item catalog, open and close days, adjust quantities, enter prices and payers, promote/demote managers |

- There can be multiple managers. Managers order and have balances like everyone else.
- Bootstrap: emails listed in the `ADMIN_EMAILS` env var (comma-separated) become managers when they sign in.

## Auth

- Google sign-in only, through Better Auth. Any Google account can sign in, with no domain restriction or approval step. The site is not indexed (`robots.txt` disallow plus `noindex`).
- Managers can deactivate a member. Deactivated members can't order, but their ledger history stays.

## Item catalog

- Managers maintain a master list of items: name (Bangla + English), unit (e.g. piece, cup), active flag.
- Items are never hard-deleted once used. They are archived instead.
- An item has one name (no separate Bangla/English names). Units come from bilingual presets.
- Prices are not part of the catalog; they are entered per day.

## Daily flow

A day moves through these states:

1. **Draft**: a manager creates today's menu by ticking items from the catalog.
2. **Open**: members see "Aj khaben?" and choose items and quantities, or "Na, aj khabo na". They can edit or cancel any number of times.
3. **Closed**: a manager closes ordering by hand. Members can no longer edit. The manager sees the **purchase summary** (total quantity per item, e.g. 23 paratha, 12 egg) and the per-person list.
4. **Finalized**: after buying, a manager enters:
   - what each item **cost in total** that day. Prices change day to day, and on some days one item comes from more than one shop at different prices; the total covers both. The form starts from the previous day's cost so a normal day is quick to confirm,
   - the day's **delivery fee**, if any: one total for the day (add fees together if more than one rider came),
   - **adjusted quantities** per member where needed (an item ran out, fewer were bought, a late add),
   - **who paid** the shop: one or more members with amounts. The amounts must add up to the day's total: all item costs plus the delivery fee.

   Finalizing posts the day to the ledger.

- Days with no menu (weekends, holidays) simply don't exist. Nothing is scheduled automatically.
- A manager can reopen a closed or finalized day. Every change after finalizing is recorded in an audit log (who changed what, when).
- A manager can add an order for a member while the day is Closed.

## Money and ledger

- Currency is BDT, stored as integer poisha (no floats). The timezone is Asia/Dhaka, and the "day" and "month" boundaries use it.
- Ledger entries:
  - **Charge**: for each item, its total cost is split across the units actually eaten (final quantities), so everyone pays the same per-piece price for that item that day. Shares are whole poisha that add up exactly to the total; leftover poisha go to the largest fractional shares in a fixed order. The day's delivery fee is split equally among everyone who ate that day (members who skipped pay none of it), again in whole poisha that add up exactly. A member's charge for the day is the sum over items plus their share of the delivery fee. Finalizing is blocked if there is a delivery fee but nobody ate. This reduces the member's balance.
  - **Bill payment**: a member paid the shop X on a day. This increases their balance.
  - **Settlement**: A paid B X (cash or bKash, outside the app). A's balance goes up and B's goes down. **Anyone** (A, B, or a manager) can log it. It records who logged it, and it can be voided (soft-delete, audited) by the logger or a manager.
- **Net balance** per member = bill payments + settlements sent − charges − settlements received. Positive means others owe you, negative means you owe.
- **Settle-up suggestions**: a simplified set of transfers (fewest payments) that would bring every balance to zero, Splitwise-style.

## Reports (visible to everyone)

- **Balances**: every member's current net balance plus suggested settle-up transfers.
- **Monthly report** per member: opening balance, a line per day (items × qty × price), bill payments, settlements in and out, closing balance. Balances carry over across months.
- **Monthly overview**: all members' charges, payments and closing balance for the month.
- **CSV export** of the month's ledger (managers).

## UI

- Mobile-first and installable as a PWA (manifest + icons; offline support not required).
- Bangla by default, with an English toggle. Numbers and currency are formatted to match the locale (৳).
- The home screen for a member is today's "Aj khaben?" card, showing either the order form or their order and the day's status.

## Out of scope (v1)

- Online payment integration (bKash/Nagad APIs)
- Push, email or SMS notifications
- Multiple offices or groups
- Automatic daily scheduling or cutoff times

## Open points (defaults chosen; change if needed)

- A member who doesn't respond on an open day is treated as "not eating".
- Settlement suggestions are only suggestions. Balances change only when a settlement is logged.
- Rounding: no rounding needed because prices are per unit and charges are integer poisha.
