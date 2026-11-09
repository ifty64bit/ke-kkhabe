# Monthly calendar report: design

Date: 2026-11-09 · Status: approved in chat (section 1); remaining details decided here

## Problem

`/reports` is a placeholder (`src/routes/(app)/reports/+page.svelte` always shows "This
month's report is empty"). Members cannot see, day by day, what they ate and what it cost;
managers cannot see the whole office's month at a glance.

## Goal

- A square grid of the month's days. Each square's colour says whether the person ate that
  day. Hovering (desktop) or tapping (phone) a square opens a popover with that day's order
  details and charge.
- A **member** sees only their own month.
- A **manager** sees everyone: one row per member, days across. A "Me / Everyone" switch
  lets a manager see their own calendar too.

## Non-goals

- Settlements in the popover (they stay in the settlement book, `/ledger/history`).
- Opening/closing balance lines, CSV export (the old Reports bullets). Not built now.
- Any new dependency (no popover/positioning library).

## Access rule (spec change)

`docs/REQUIREMENTS.md` currently says reports are visible to everyone. Change it: a member
sees only their own monthly report; a manager sees every member's. Update the Roles table
("view the ledger and reports for everyone") and the "## Reports" heading/bullets to match.

The server enforces it: for a member, the load returns only their own person row, whatever
the query string says. `?view=all` is honoured only for managers.

## URL

`/reports?month=YYYY-MM&view=me|all`

- `month` defaults to the current month in Asia/Dhaka (`dhakaToday().slice(0, 7)`). An
  invalid value falls back to the current month. Future months are allowed but empty.
- `view` defaults to `all` for managers, and is always `me` for members.
- ◀ ▶ links move one month. The month title uses `i18n.month(month)`.

## Square states

| State         | When                                                                                                 | Look                        |
| ------------- | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| `ate`         | a `day` exists, and the person has a positive quantity (final quantity when finalized, else ordered) | filled, strong accent token |
| `skipped`     | a `day` exists and their `response.eating = false`                                                   | filled, muted token         |
| `noAnswer`    | a `day` exists and they have no response and no lines                                                | outlined                    |
| `noBreakfast` | no `day` row for that date (weekend, holiday) or a `draft` day                                       | faint / empty               |

Today's square gets a ring. A legend sits under the grid. Colours use semantic tokens (light
and dark). Colour is never the only signal: each square has an `aria-label` such as
"9 November: ate, ৳74.67".

## Popover (one person, one day)

- Date (`i18n.day(date)`) and, if the day is not finalized, a "Not final yet" badge.
- Lines: item name × quantity (`formatQty`) with unit; for finalized days, the person's share
  of each item's cost.
- Delivery share and discount share (finalized days, when non-zero).
- **Charge** for the day (finalized only).
- **Paid the shop** amount, if they have a `bill_payment` that day.
- For `skipped`: "Skipped". For `noAnswer`: "No answer". `noBreakfast` squares have no
  popover.

## Month totals

- Member view (above the grid): days eaten, total charged, total paid to the shop.
- Everyone view: per-row totals column at the end (days eaten, charged), plus office totals
  above the grid (days with breakfast, total charged, total paid).
- Totals count finalized days only for money; "days eaten" counts `ate` squares.

## Layout

- **Member view (`me`)**: 7-column calendar, weeks Saturday to Friday, date number in each
  square, leading blanks before day 1. Squares are square (`aspect-square`), fill the width
  on phones.
- **Everyone view (`all`)**: a table-like grid, sticky first column with avatar + name, one
  column per day of the month (1..28–31) with the day number header, totals column last.
  Scrolls horizontally inside its own container on phones (no page-level horizontal scroll).
  Rows: active members first (by name), then inactive members who have any data that month.

## Units

### `src/lib/report.ts` (pure, unit-tested)

```ts
export type CellState = 'ate' | 'skipped' | 'noAnswer' | 'noBreakfast';
export type CellLine = {
	itemId: string;
	name: string;
	unitBn: string;
	unitEn: string | null;
	quantity12ths: number;
	share: Poisha | null;
};
export type Cell = {
	state: CellState;
	final: boolean; // day finalized
	lines: CellLine[];
	deliveryShare: Poisha;
	discountShare: Poisha;
	charge: Poisha | null; // null unless finalized
	paid: Poisha; // bill payments that day
};
export type PersonMonth = {
	id: string;
	name: string;
	image: string | null;
	active: boolean;
	cells: Record<string, Cell>; // keyed by YYYY-MM-DD, only dates with a non-draft day
	totals: { daysEaten: number; charged: Poisha; paid: Poisha };
};
export type MonthReport = {
	month: string; // YYYY-MM
	dates: string[]; // every date of the month
	days: { date: string; status: DayStatus }[]; // non-draft days in the month
	people: PersonMonth[];
	totals: { breakfastDays: number; charged: Poisha; paid: Poisha };
};

export function datesOfMonth(month: string): string[];
export function calendarWeeks(month: string): (string | null)[][]; // Sat-first weeks, null = blank
export function buildMonthReport(input: MonthInput, userIds: string[] | 'all'): MonthReport;
```

`MonthInput` is the raw rows for the month: days, day items (with item name/unit and
`totalCost`), order lines (`quantity12ths`, `finalQuantity12ths`), responses, bill payments,
users. Charges come from the existing pure `computeBreakdown` (`#lib/charges.ts`) per
finalized day, so they match the ledger exactly.

### `src/lib/server/report.ts`

`loadMonthInput(db, month): Promise<MonthInput>`: a handful of queries bounded by
`day.date` between the first and last date of the month (no per-day query loop).

### `src/routes/(app)/reports/+page.server.ts`

Load: parse `month` and `view`, apply the access rule, return `MonthReport` plus
`{ isManager, view, today }`.

### UI

- `src/lib/components/ui/Popover.svelte`: new primitive. One instance, anchored to an
  element; opens on hover and focus (desktop) and on tap (touch); closes on Escape, outside
  tap, or pointer leave (with a short delay so the pointer can move into it). Flips to stay
  inside the viewport. `role="dialog"` (non-modal) with `aria-labelledby`; the anchored square
  gets `aria-expanded`/`aria-controls`. Export from `ui/index.ts`; add to the `/ui` gallery.
- `src/lib/components/reports/DaySquare.svelte`: one square (state classes, date number
  optional, aria-label).
- `src/lib/components/reports/DayDetail.svelte`: popover content for a `Cell`.
- `src/lib/components/reports/MonthCalendar.svelte`: member 7-column view.
- `src/lib/components/reports/TeamGrid.svelte`: manager rows view.
- `src/lib/components/reports/Legend.svelte`.
- Page uses `PageHeader`, month nav, `SegmentedControl` for Me / Everyone (managers only),
  `EmptyState` when the month has no breakfast days.

All text via i18n keys under `reports.*` in `bn.ts` and `en.ts`; replace the placeholder
`reports.description` / `reports.empty*` strings to fit the new page.

## Testing

`src/lib/report.test.ts`:

- `datesOfMonth('2026-02')` has 28 dates; `'2028-02'` has 29.
- `calendarWeeks('2026-11')`: 1 Nov 2026 is a Sunday, so the first week is `[null, '2026-11-01', ...]` (Saturday blank); every week has 7 entries.
- States: ate (ordered on an open day), ate (final quantity on a finalized day), a finalized
  day where the final quantity was set to 0 → not ate (skipped if response false, else
  noAnswer), skipped, noAnswer, draft day → no cell.
- Finalized day charge equals `computeBreakdown(...).get(user).total`; item shares and
  delivery/discount shares match.
- Bill payment shows in `paid` and totals.
- `userIds` filter: a member's report contains only that member.
- Inactive member with no data that month is left out of `'all'`; with data, included.
- Totals: daysEaten counts ate cells; charged/paid sum finalized days only.

Manual: member sees only their calendar (try `?view=all` as a member: still only self);
manager sees all rows and the switch; hover/tap popovers on desktop and phone; light and dark;
bn and en.
