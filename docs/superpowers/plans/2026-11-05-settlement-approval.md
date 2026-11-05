# Settlement Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A settlement logged by the payer or a manager waits for the receiver to approve or reject it, and only approved settlements move balances.

**Architecture:** A `status` column on the existing `settlement` table (`pending | approved | rejected`) with `decided_by` / `decided_at` / `reject_reason`. The rules live as pure functions in `src/lib/ledger.ts` (who starts pending, who may decide or void, which rows count). The ledger page gets `approve` / `reject` actions and a "waiting for you" card. Today shows a banner.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM on Cloudflare D1 (SQLite), Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-11-05-settlement-approval-design.md`

## Global Constraints

- Status starts `approved` only when the logger is the receiver (`meId === toUserId`); otherwise `pending`. Who may record is unchanged (`canRecordSettlement`).
- Only the receiver may approve or reject, and only while `pending`. Rejected rows are final: no approve, no void.
- Balances and settle-up suggestions count only `approved`, non-voided rows.
- Reject reason: optional, trimmed, '' → null, at most `MAX_NOTE` = 100 characters.
- Migration is additive (`drizzle/0001_*`), with `status` default `approved`. **Never regenerate `0000`**: the remote D1 holds real users.
- All UI text goes through `useI18n`, with keys in both `en.ts` and `bn.ts`. Build only from `src/lib/components/ui`, using semantic tokens.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Approve or reject posted by someone other than the receiver** (the payer approving their own payment, a manager approving on A's behalf): must return 403 and change nothing. Test: Task 1 (`canDecideSettlement` with payer, manager and stranger).
2. **Deciding twice / racing** (double tap, or approve after the logger cancelled): the second request must get 409, and the status must not flip from rejected to approved. Test: Task 1 (`canDecideSettlement` false for approved, rejected and voided rows).
3. **A pending row must never move a balance or a settle-up suggestion**, including when it is the only settlement between two people. Test: Task 1 (`balancesFrom` with a pending and a rejected row).
4. **A manager logging a settlement where they are the receiver** counts at once (they are A); a manager logging someone else's goes pending. Test: Task 1 (`initialSettlementStatus`).
5. **A reject reason of whitespace only, or 101 characters**: whitespace becomes null, and 101 is refused with an error rather than silently truncated. Test: Task 1 (`validateRejectReason`).

---

### Task 1: Pure rules in `src/lib/ledger.ts`

**Files:**

- Modify: `src/lib/ledger.ts` (types ~line 18, `balancesFrom` ~41, permissions ~120)
- Test: `src/lib/ledger.test.ts`

**Interfaces:**

- Produces:
  - `SETTLEMENT_STATUSES = ['pending', 'approved', 'rejected'] as const` and `type SettlementStatus`
  - `LedgerSettlement` gains `status: SettlementStatus`
  - `initialSettlementStatus(meId: string, toUserId: string): SettlementStatus`
  - `canDecideSettlement(meId: string, row: { toUserId: string; status: SettlementStatus; voidedAt: Date | null }): boolean`
  - `canVoidSettlement(meId: string, isManager: boolean, createdBy: string, status: SettlementStatus): boolean`
  - `validateRejectReason(raw: string): { ok: true; value: string | null } | { ok: false; error: MessageKey }`, where the error key is `'ledger.error.reasonLong'`

- [ ] **Step 1: Write the failing tests.** Add `status: 'approved'` to every existing settlement fixture, and add `status` to the existing `canVoidSettlement` calls. New tests:
  - `initialSettlementStatus('a', 'a')` → `'approved'`; `('b', 'a')` → `'pending'`; manager `'m'` logging to `'a'` → `'pending'`.
  - `canDecideSettlement`: true for `('a', {toUserId:'a', status:'pending', voidedAt:null})`; false for the payer `'b'` and for `'m'`; false when the status is `'approved'` or `'rejected'`; false when `voidedAt` is set.
  - `canVoidSettlement('b', false, 'b', 'rejected')` → false; `('m', true, 'b', 'rejected')` → false; `('b', false, 'b', 'pending')` → true.
  - `balancesFrom`: with only `{u1→u2 ৳100 pending}` and `{u1→u2 ৳50 rejected}` added to the base fixture, the balances equal those of the base fixture without them.
  - `validateRejectReason('  ')` → `{ok:true, value:null}`; `(' পাইনি ')` → `'পাইনি'`; `'x'.repeat(101)` → `{ok:false, error:'ledger.error.reasonLong'}`; `'x'.repeat(100)` → ok.
- [ ] **Step 2: Run** `bunx vitest run src/lib/ledger.test.ts`. Expected: FAIL (missing exports and type errors).
- [ ] **Step 3: Implement.** In `balancesFrom`, skip a settlement unless `status === 'approved' && !voidedAt`. Add the `'ledger.error.reasonLong'` key to `en.ts`/`bn.ts` (en: "Keep the reason under 100 characters."; bn: "কারণ ১০০ অক্ষরের মধ্যে লিখুন।").
- [ ] **Step 4: Run** `bun run test`. Expected: all PASS. (`bun run check` fails until Task 2 updates the callers. That's acceptable mid-task, but Task 2 must restore it.)
- [ ] **Step 5: Commit** with the message "Settlement approval: pure status rules".

### Task 2: Schema, migration and server actions

**Files:**

- Modify: `src/lib/server/db/schema.ts` (`settlement`)
- Create: `drizzle/0001_*.sql` and its snapshot (via `bun run db:generate`)
- Modify: `src/lib/server/ledger.ts` (settlement query ~line 38)
- Modify: `src/routes/(app)/ledger/+page.server.ts` (load ~60–100, `record`, `void`, new `approve` / `reject`)
- Modify: `src/routes/(app)/+page.server.ts` (Today load: `awaitingMeCount`)
- Modify: `src/lib/i18n/en.ts`, `bn.ts` (error keys)

**Interfaces:**

- Consumes: everything from Task 1.
- Produces:
  - Drizzle columns `settlement.status` (`text('status', { enum: SETTLEMENT_STATUSES }).notNull().default('approved')`), `decidedBy` (`decided_by`, user ref), `decidedAt` (`decided_at`, timestamp_ms), `rejectReason` (`reject_reason`), and an index `settlement_to_status_idx` on (`toUserId`, `status`).
  - Ledger page data:
    - `awaitingMe: { id, fromId, fromName, amount, date, note }[]` (pending, I am the receiver, oldest first)
    - `recent` rows gain `status`, `rejectReason` and `decidedByName`
    - `myPending: Poisha` (sum of my pending outgoing)
  - The `record` action returns `{ saved: true, pending: boolean }`.
  - New actions `approve` and `reject` (form fields `id`, and `reason` for reject). Errors: `ledger.error.notFound` 404; `ledger.error.decidePermission` 403; `ledger.error.notPending` 409; reason errors return `fail(400, { errors: { reason: key } })`.
  - Today data: `awaitingMeCount: number`.

- [ ] **Step 1: Update the schema** and run `bun run db:generate`. Expected: exactly one new file, `drizzle/0001_*.sql`, which only adds columns and the index (it recreates the table only if drizzle must for the enum check; inspect it and make sure the data copy keeps every row with `status` = 'approved'). `0000` is unchanged (`git diff --stat drizzle/0000*` is empty).
- [ ] **Step 2: Apply locally.** Run `bun run db:migrate:local`. Expected: `0001` ✅.
- [ ] **Step 3: Update the server code.**
  - `computeLedger` adds `status` to the selected fields and filters `eq(settlement.status, 'approved')`.
  - `record` inserts `status: initialSettlementStatus(me.id, v.toUserId)`.
  - `void` passes `row.status` to `canVoidSettlement`.
  - `approve` and `reject` load the row and check `canDecideSettlement`: 404 for a missing row, 403 when the user isn't the receiver, 409 when the row isn't pending or is voided. Then they batch-update the row (`status`, `decidedBy`, `decidedAt`, plus `rejectReason`) and insert an `auditLog` entry (`settlement.approve` / `settlement.reject`, data `{from, to, amount, date, reason?}`).
  - Add the load fields above. The `recent` query leaves out voided rows, as today.
- [ ] **Step 4: Add the error keys** in both locales. en: `decidePermission` "Only the person who received the money can confirm it.", `notPending` "This request was already handled." bn: "শুধু যিনি টাকা পেয়েছেন তিনিই নিশ্চিত করতে পারেন।", "এই অনুরোধ আগেই নিষ্পত্তি হয়েছে।"
- [ ] **Step 5: Run** `bun run check && bun run test`. Expected: 0 errors, all PASS.
- [ ] **Step 6: Commit** `src drizzle` with the message "Settlement approval: schema, migration, approve/reject actions".

### Task 3: Screens

**Files:**

- Modify: `src/routes/(app)/ledger/+page.svelte` (new card above the balances; recent list ~173–230; own balance)
- Modify: `src/lib/components/ledger/RecordDialog.svelte` (hint; `onsaved` callback)
- Modify: `src/routes/(app)/+page.svelte` (banner)
- Modify: `src/lib/i18n/en.ts`, `bn.ts`

**Interfaces:**

- Consumes: Task 2 page data and actions. `canVoidSettlement` now takes a 4th argument (`s.status`).
- Produces: `RecordDialog` prop `onsaved?: (pending: boolean) => void`.

- [ ] **Step 1: Ledger page.**
  - **"Waiting for you" card** (`ledger.awaiting.title`), shown whenever `awaitingMe.length > 0`, even before any day is finalized: place it above the `hasFinalized` branch. Each row shows `{from} → {you} {amount}`, then the date and note, then two buttons:
    - "পাইনি" (`ledger.awaiting.reject`, secondary) opens a reject `Dialog` with an optional `Textarea name="reason"` and posts `?/reject`.
    - "পেয়েছি" (`ledger.awaiting.approve`) posts `?/approve`.
  - **Recent rows:** pending shows `Badge` `ledger.status.pending`, and its menu item reads `ledger.cancelRequest` (same void flow). Rejected shows `Badge tone="danger"` `ledger.status.rejected`, plus the line `ledger.rejectedBy` `{name, reason}` (`ledger.rejectedByNoReason` when there's no reason). Rejected rows show no menu.
  - **Own balance:** under it, when `myPending > 0`, show `ledger.myPending` `{amount}`.
  - **After a pending save:** show a success `Alert` `ledger.sentForApproval` `{name}` (from `onsaved`).
- [ ] **Step 2: Record dialog.** When the chosen `to` ≠ `meId`, show a muted hint `ledger.needsApproval` `{name}`. After a successful save, call `onsaved(result.data.pending)`.
- [ ] **Step 3: Today.** When `data.awaitingMeCount > 0`, show `Alert tone="info"` with `today.awaitingApproval` `{count}` and a link to `/ledger` (`today.awaitingApprovalCta`).
- [ ] **Step 4: Add the i18n keys** in both locales.
  - bn:
    - `awaiting.title` "আপনার অনুমোদনের অপেক্ষায়"
    - `approve` "পেয়েছি", `reject` "পাইনি"
    - `status.pending` "অপেক্ষায়", `status.rejected` "বাতিল"
    - `rejectedBy` "{name} বাতিল করেছেন: {reason}", `rejectedByNoReason` "{name} বাতিল করেছেন"
    - `needsApproval` "{name} অনুমোদন করলে ব্যালান্সে যোগ হবে"
    - `myPending` "{amount} অনুমোদনের অপেক্ষায়"
    - `sentForApproval` "{name}-এর কাছে অনুমোদনের জন্য পাঠানো হয়েছে"
    - `cancelRequest` "অনুরোধ বাতিল করুন"
    - `rejectTitle` "টাকা পাননি?", `rejectReason` "কারণ (ঐচ্ছিক)"
    - `today.awaitingApproval` "{count}টি পেমেন্ট আপনার অনুমোদনের অপেক্ষায়", `today.awaitingApprovalCta` "দেখুন"
  - en: the matching English text ("Waiting for your approval", "Got it", "Didn't get it", "Pending", "Rejected", "{name} rejected: {reason}", "Counts once {name} approves", "{amount} waiting for approval", "Sent to {name} for approval", "Cancel request", "Didn't get the money?", "Reason (optional)", "{count} payment(s) waiting for your approval", "View").
- [ ] **Step 5: Run** `bun run format && bun run check && bun run lint && bun run test`. Expected: clean, all PASS.
- [ ] **Step 6: Commit** with the message "Settlement approval: waiting card, statuses, record hint, Today banner".

### Task 4: Docs

**Files:**

- Modify: `docs/REQUIREMENTS.md` (Settlement entry, line 53; the constraint at line 80)
- Modify: `docs/decisions.md` (append)

- [ ] **Step 1: Update REQUIREMENTS.**
  - Settlement entry: the receiver's own entry counts at once; the payer's or a manager's entry is pending until the receiver approves ("পেয়েছি") or rejects ("পাইনি", optional reason). Only approved settlements change balances. Rejected entries are final. The logger or a manager can cancel a pending one.
  - Line 80: change "…when a settlement is logged" to "…when a settlement is approved".
- [ ] **Step 2: Append to decisions.md**, in the existing format: "## 2026-11-05 · A settlement counts once the receiver approves it". Decided by: the designer. Why: only the receiver knows the money arrived. Rejected: approving a different amount (log a new settlement instead); manager entries counting at once. Rests on: the settlement ledger rules.
- [ ] **Step 3: Commit** with the message "Docs: settlement approval".
