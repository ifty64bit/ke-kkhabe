# Settlement approval — design

Date: 2026-11-05 · Status: approved in chat, pending spec review

## Problem

Today a settlement ("B paid A ৳50") counts the moment anyone logs it. The receiver never
confirms that the money arrived, so a mistaken or wishful entry moves balances.

## Goal and success criteria

- A payment only moves balances once the person who received it (A) confirms it.
- When A logs it themselves, it counts at once: logging it is the confirmation.
- A sees what is waiting for them without push notifications.
- B can see that their payment is waiting, and why it was rejected if it was.

## Non-goals

- Approving a different amount. If A got ৳40 instead of ৳50, A rejects, and a new ৳40
  settlement is logged.
- Push, email or SMS notifications.
- Editing a pending request. The logger cancels it and logs a new one.

## Rules

Who logs "B → A ৳X" decides the starting status:

| Logged by              | Status     |
| ---------------------- | ---------- |
| A (the receiver)       | `approved` |
| B (the payer)          | `pending`  |
| A manager who is not A | `pending`  |

Who may record is unchanged (`canRecordSettlement`: the payer, the receiver, or a manager).

- **Approve / reject:** only the receiver (`toUserId`), only while `pending`. Each writes an
  audit entry (`settlement.approve`, `settlement.reject`). A reject may carry a reason
  (optional, at most `MAX_NOTE` = 100 characters).
- **Cancel a pending request:** the existing void action, with its existing permission
  (the logger or a manager). Same soft-delete and audit as today.
- **Void an approved settlement:** unchanged.
- **Rejected rows are final:** they cannot be approved, voided or reopened later. They stay
  visible in the recent list.
- **Balances and settle-up suggestions** count only rows that are `approved` and not voided.
  Pending and rejected rows never move a balance.

## Data model

New columns on `settlement`, added with a normal drizzle migration (`0001_*`). Additive, so
the remote D1 keeps its data.

- `status` text enum `pending | approved | rejected`, not null, default `approved`. Existing
  rows become `approved`.
- `decided_by` (user ref, nullable) and `decided_at` (timestamp ms, nullable): set on approve
  or reject.
- `reject_reason` text, nullable.
- Index on (`to_user_id`, `status`) for the "waiting for you" query.

## Pure logic (`src/lib/ledger.ts`)

- `SETTLEMENT_STATUSES` and `type SettlementStatus`.
- `initialSettlementStatus(meId: string, toUserId: string): SettlementStatus`: `approved`
  when `meId === toUserId`, else `pending`.
- `canDecideSettlement(meId: string, row: { toUserId: string; status: SettlementStatus }): boolean`:
  true only for the receiver of a pending row.
- `canVoidSettlement` also takes the status and returns false for `rejected`.
- `LedgerSettlement` gains `status`, and `balancesFrom` skips anything that is not
  `approved`. The server query also filters on it, but the pure function is the source of truth.
- `validateRejectReason(raw: string)`: trims it, treats '' as null, and rejects anything over `MAX_NOTE`.

## Server (`src/routes/(app)/ledger/+page.server.ts`, `src/lib/server/ledger.ts`)

- `record`: sets `status` from `initialSettlementStatus`, and returns `{ saved: true, pending: boolean }`.
- New `approve` and `reject` actions (form field `id`; `reason` for reject). They check
  `canDecideSettlement`, update `status`, `decidedBy` and `decidedAt` (plus `rejectReason`),
  and write the audit entry in one batch. Error keys: not found → 404; not allowed → 403;
  not pending → 409.
- `void`: refuses `rejected` rows (409).
- `computeLedger`: loads only `approved`, non-voided settlements.
- The load returns:
  - `awaitingMe`: pending rows where I am the receiver, oldest first.
  - `recent`, now with `status`, `rejectReason` and the decider's name.
  - `myPending`: the total of my pending outgoing settlements (where I am the payer).
- Today load (`src/routes/(app)/+page.server.ts`): returns `awaitingMeCount`.

## Screens

All text goes through `useI18n`, with keys in both `en.ts` and `bn.ts`. Built from `src/lib/components/ui`.

- **Ledger, top card "আপনার অনুমোদনের অপেক্ষায়"**: only when `awaitingMe` is non-empty. Each
  row shows: payer → you, amount, date and note, plus two buttons: "পাইনি" (reject; opens a
  small dialog with an optional reason) and "পেয়েছি" (approve).
- **Recent settlements:** a pending row gets an "অপেক্ষায়" badge, and its cancel uses the
  existing void control (wording: cancel request). A rejected row gets a "বাতিল" badge and
  the line "{receiver} বাতিল করেছেন: {reason}". Approved rows look as they do today.
- **Record dialog:** when the entry will be pending (I am not the receiver), it shows
  the hint "{receiver} অনুমোদন করলে ব্যালান্সে যোগ হবে". After saving a pending entry, the
  success state says it was sent for approval.
- **Own balance:** when `myPending > 0`, the note "৳X অনুমোদনের অপেক্ষায়" appears under it.
- **Today:** when `awaitingMeCount > 0`, a small banner reads "{n}টি পেমেন্ট আপনার অনুমোদনের
  অপেক্ষায় → দেখুন" and links to `/ledger`.

## Docs

- `docs/REQUIREMENTS.md`: the Settlement ledger entry describes the approval flow, and the
  constraint "Balances change only when a settlement is logged" becomes "…is approved".
- `docs/decisions.md`: a new entry for receiver approval (who starts pending, no partial
  amounts, rejected rows are final).

## Testing

- `ledger.test.ts`:
  - `initialSettlementStatus`: receiver → approved; payer or manager → pending.
  - `canDecideSettlement`: receiver of a pending row only; never for approved or rejected rows.
  - `canVoidSettlement`: refuses rejected rows.
  - `balancesFrom`: ignores pending and rejected rows. An approved row still moves both balances.
  - `validateRejectReason`: trims, '' → null, 101 characters → error.
- Type-check and lint stay clean. The migration applies on a fresh local DB.
