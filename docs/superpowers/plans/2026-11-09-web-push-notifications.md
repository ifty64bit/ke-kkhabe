# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members get browser/PWA push notifications for four events (day opened, day finalized, settlement waiting for approval, settlement decided), with per-event preferences and per-device opt-in.

**Architecture:** A dependency-free Web Push sender on WebCrypto (`src/lib/server/push/webpush.ts`) is wrapped by a pure, store-injected `notify()` that filters recipients and cleans up dead subscriptions. Existing form actions call it via `ctx.waitUntil` after their DB writes. The browser side is a plain `static/sw.js`, a PWA manifest, a `/notifications` settings page and a Today nudge card.

**Tech Stack:** SvelteKit (Svelte 5) on Cloudflare Workers, D1 + Drizzle, WebCrypto, Vitest, Tailwind v4, Bun.

**Spec:** `docs/superpowers/specs/2026-11-09-web-push-notifications-design.md`

## Global Constraints

- No new runtime dependencies. No Firebase, no `web-push` npm package.
- All server crypto uses `crypto.subtle` (works in Workers and in Node for Vitest).
- All user-facing text goes through i18n: keys added to `src/lib/i18n/bn.ts` (the source of `MessageKey`) **and** `src/lib/i18n/en.ts`. Server uses `translate(locale, key, params)`; components use `useI18n()`.
- UI is built from `src/lib/components/ui` primitives with semantic tokens; no sidebar.
- Money is integer poisha; format with `formatTaka(poisha, locale)` from `#lib/money.ts`.
- Vitest covers pure modules only (no SvelteKit, no database): `vitest.config.ts` includes `src/**/*.test.ts`.
- A push failure must never fail or delay the action that triggered it.
- The actor is never notified about their own action.
- Only users with `active = true` receive pushes.
- VAPID env names: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (base64url), `VAPID_SUBJECT` (`mailto:`).
- Verify after every task: `bun run test`, `bun run check`, `bun run lint` all pass.

## Review Focus

1. **Endpoint reused across accounts**: the same browser signs out and another member signs in and turns notifications on. Expected: the existing `push_subscription` row moves to the new user (upsert on `endpoint`), and the old user stops getting pushes on that device. Test: Task 6 `upsertSubscriptionValues` test.
2. **Unsubscribe someone else's endpoint**: a forged `unsubscribe` POST with another user's endpoint. Expected: nothing deleted. Test: Task 6 asserts the delete's `where` includes `userId = me`. (Reviewer check, since it is DB code.)
3. **Missing VAPID keys in local dev**: actions must still succeed and the page must show "unavailable" rather than crash. Test: Task 3 `vapidFromEnv` returns `null` for partial env; Task 3 `notify` with `vapid: null` sends nothing.
4. **Settlement recorded by a manager for two other people**: `record` creates `pending`; the receiver (not the manager) is notified, and on decision the manager (the `createdBy`) is notified. Test: Task 4 `settlementRecipients` tests.
5. **Push service returns 413/429/500 or `fetch` throws**: the row is kept, nothing propagates, and the other recipients still get theirs. Test: Task 3 `notify` mixed-results test.

---

### Task 1: Web Push protocol module

**Files:**

- Create: `src/lib/server/push/base64url.ts`
- Create: `src/lib/server/push/webpush.ts`
- Create: `src/lib/server/push/webpush.test.ts`
- Create: `scripts/vapid-keys.ts`

**Interfaces:**

- Produces:
  - `b64uEncode(bytes: Uint8Array): string`, `b64uDecode(s: string): Uint8Array` (in `base64url.ts`, no padding).
  - `type Vapid = { publicKey: string; privateKey: string; subject: string }` (base64url: 65-byte uncompressed P-256 point / 32-byte `d`).
  - `type PushTarget = { endpoint: string; p256dh: string; auth: string }`
  - `encryptPayload(plaintext: Uint8Array, target: Pick<PushTarget, 'p256dh' | 'auth'>, opts?: { salt?: Uint8Array; serverKey?: { publicKey: string; privateKey: string } }): Promise<Uint8Array>`: the full `aes128gcm` body (header + one record).
  - `vapidAuthorization(endpoint: string, vapid: Vapid, now?: number): Promise<string>`: returns `vapid t=<jwt>, k=<publicKey>`.
  - `sendWebPush(target: PushTarget, payload: string, vapid: Vapid, opts?: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; fetch?: typeof fetch }): Promise<{ status: number }>`

- [ ] **Step 1: Write the failing tests** in `webpush.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { b64uDecode, b64uEncode } from './base64url.ts';
import { encryptPayload, sendWebPush, vapidAuthorization } from './webpush.ts';

// RFC 8291 §5. Verify every value against https://www.rfc-editor.org/rfc/rfc8291#section-5 before relying on it.
const RFC = {
	plaintext: 'When I grow up, I want to be a watermelon',
	asPublic:
		'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	uaPublic:
		'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	auth: 'BTBZMqHH6r4Tts7J_aSIgg',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};

describe('base64url', () => {
	it('round-trips without padding', () => {
		const bytes = new Uint8Array([0, 251, 255, 1, 2]);
		expect(b64uEncode(bytes)).not.toMatch(/[=+/]/);
		expect(b64uDecode(b64uEncode(bytes))).toEqual(bytes);
	});
});

describe('encryptPayload', () => {
	it('matches the RFC 8291 example byte for byte', async () => {
		const out = await encryptPayload(
			new TextEncoder().encode(RFC.plaintext),
			{ p256dh: RFC.uaPublic, auth: RFC.auth },
			{
				salt: b64uDecode(RFC.salt),
				serverKey: { publicKey: RFC.asPublic, privateKey: RFC.asPrivate }
			}
		);
		expect(b64uEncode(out)).toBe(RFC.body);
	});
});

describe('vapidAuthorization', () => {
	it('signs an ES256 JWT for the endpoint origin that verifies with the public key', async () => {
		const keys = await generateTestVapid(); // helper in the test: crypto.subtle.generateKey ECDSA P-256 → export raw pub + jwk.d
		const now = 1_800_000_000_000;
		const header = await vapidAuthorization(
			'https://fcm.googleapis.com/fcm/send/abc',
			{ ...keys, subject: 'mailto:a@b.c' },
			now
		);
		const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
		expect(k).toBe(keys.publicKey);
		const [h, p, s] = jwt.split('.');
		expect(JSON.parse(new TextDecoder().decode(b64uDecode(h)))).toEqual({
			typ: 'JWT',
			alg: 'ES256'
		});
		expect(JSON.parse(new TextDecoder().decode(b64uDecode(p)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: Math.floor(now / 1000) + 12 * 3600,
			sub: 'mailto:a@b.c'
		});
		// verify signature s over `${h}.${p}` with keys.publicKey (raw import, ECDSA SHA-256) → true
	});
});

describe('sendWebPush', () => {
	it('POSTs the encrypted body with the required headers and returns the status', async () => {
		// stub fetch capturing (url, init); return new Response(null, { status: 201 })
		// expect: method POST, url = endpoint, headers TTL '86400', Urgency 'normal',
		//   'Content-Encoding' 'aes128gcm', 'Content-Type' 'application/octet-stream',
		//   Authorization starting 'vapid t='; body is a Uint8Array; result { status: 201 }
	});
	it('returns 410 as a status, not an exception', async () => {
		// stub fetch → 410; expect resolves to { status: 410 }
	});
	it('passes ttl and urgency through', async () => {
		// opts { ttl: 60, urgency: 'high' } → headers TTL '60', Urgency 'high'
	});
});
```

Fill the three commented test bodies with real code; their assertions are listed in the comments.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/server/push/webpush.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `base64url.ts` and `webpush.ts`**

Encryption algorithm (RFC 8291 §3.3–3.4, RFC 8188), which the signature does not determine:

```
uaPub   = b64uDecode(p256dh)            // 65 bytes
authSec = b64uDecode(auth)              // 16 bytes
server  = opts.serverKey ?? fresh ECDH P-256 pair; asPub = raw export (65 bytes)
ecdh    = deriveBits(ECDH, server.private, import(uaPub), 256)
ikm     = HKDF-SHA256(salt=authSec, ikm=ecdh, info="WebPush: info\0" || uaPub || asPub, 32)
salt    = opts.salt ?? random 16 bytes
cek     = HKDF-SHA256(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
nonce   = HKDF-SHA256(salt, ikm, "Content-Encoding: nonce\0", 12)
record  = AES-GCM(cek, nonce, plaintext || 0x02)      // single last record, no extra padding
body    = salt(16) || rs=4096 as uint32 BE || idlen=65 (1 byte) || asPub(65) || record
```

- HKDF: use `crypto.subtle.importKey('raw', ikm, 'HKDF', …)` + `deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits)`.
- Importing a private key from raw `d`: WebCrypto has no raw private import. Build a JWK `{ kty: 'EC', crv: 'P-256', x, y, d }` where `x = pub[1..33]`, `y = pub[33..65]` (base64url). The same helper serves ECDH (test server key) and ECDSA (VAPID).
- Reject `plaintext.length > 3993` (4096 − 16 tag − 1 delimiter − 86 header) with an `Error`. Reject a `p256dh` that is not 65 bytes or an `auth` that is not 16.
- VAPID JWT: header `{"typ":"JWT","alg":"ES256"}`, claims `{ aud: new URL(endpoint).origin, exp: floor(now/1000) + 43200, sub }`, `crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, …)` already returns raw `r||s` (64 bytes), which is what JWS needs.
- `sendWebPush` defaults: `ttl` 86400, `urgency` `'normal'`, `fetch` = `globalThis.fetch`. Never throws on a non-2xx status.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/server/push/webpush.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Add `scripts/vapid-keys.ts`**

Generates an ECDSA P-256 pair with `crypto.subtle`, prints:

```
VAPID_PUBLIC_KEY="<b64u raw public>"
VAPID_PRIVATE_KEY="<b64u jwk.d>"
```

Run: `bun scripts/vapid-keys.ts`. Expected: two lines; the public key decodes to 65 bytes starting with `0x04`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/push scripts/vapid-keys.ts
git commit -m "Push: Web Push sender on WebCrypto (VAPID + aes128gcm)"
```

---

### Task 2: Schema, migration and env

**Files:**

- Modify: `src/lib/server/db/schema.ts` (append two tables)
- Create: `drizzle/0002_*.sql` (generated) and `drizzle/meta/*` updates
- Modify: `.env.example`, `worker-configuration.d.ts` (regenerated)

**Interfaces:**

- Produces (Drizzle tables exported from `schema.ts`):
  - `pushSubscription`: `id`, `userId` (`user_id`, not null, FK `user.id` **on delete cascade**), `endpoint` (unique, not null), `p256dh`, `auth` (not null), `userAgent` (`user_agent`, nullable), `createdAt` (use the `createdAt()` helper), `lastSuccessAt` (`last_success_at`, `timestamp_ms`, nullable); `index('push_subscription_user_idx').on(t.userId)`.
  - `notificationPref`: `userId` (`user_id`, pk, FK cascade), `dayOpened`, `dayFinalized`, `settlementPending`, `settlementDecided` (`integer(..., { mode: 'boolean' }).notNull().default(true)`; columns `day_opened`, `day_finalized`, `settlement_pending`, `settlement_decided`).
  - `Env` gains `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (strings).

- [ ] **Step 1: Add the tables to `schema.ts`.** The existing `userRef` helper has no cascade, so write `text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })`.
- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new `drizzle/0002_*.sql` containing `CREATE TABLE \`push_subscription\``with`ON DELETE cascade`, a unique index on `endpoint`, and `CREATE TABLE \`notification_pref\``.

- [ ] **Step 3: Apply locally**

Run: `bun run db:migrate:local`
Expected: the migration applies with no error.

- [ ] **Step 4: Add the env names** to `.env.example` under a `# Web Push (bun scripts/vapid-keys.ts)` comment: `VAPID_PUBLIC_KEY=""`, `VAPID_PRIVATE_KEY=""`, `VAPID_SUBJECT="mailto:"`. Then run `bun run gen` and confirm `worker-configuration.d.ts` now lists the three names.
- [ ] **Step 5: Verify**

Run: `bun run check && bun run test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle .env.example worker-configuration.d.ts
git commit -m "Push: subscription and preference tables"
```

---

### Task 3: Messages and `notify()`

**Files:**

- Create: `src/lib/server/push/events.ts` (types + pref column map, no imports beyond types)
- Create: `src/lib/server/push/messages.ts`, `src/lib/server/push/messages.test.ts`
- Create: `src/lib/server/push/notify.ts`, `src/lib/server/push/notify.test.ts`
- Create: `src/lib/server/push/store.ts` (Drizzle implementation; not unit-tested)
- Modify: `src/lib/i18n/bn.ts`, `src/lib/i18n/en.ts` (`push.*` keys)

**Interfaces:**

- Consumes: `sendWebPush`, `Vapid`, `PushTarget` (Task 1); `pushSubscription`, `notificationPref` (Task 2); `translate`, `Locale` (`#lib/i18n/index.ts`); `formatTaka` (`#lib/money.ts`).
- Produces:
  - `events.ts`:
    ```ts
    export type PushEvent =
    	'dayOpened' | 'dayFinalized' | 'settlementPending' | 'settlementDecided';
    export type PushData = {
    	dayOpened: { date: string };
    	dayFinalized: { date: string; charge: number };
    	settlementPending: { id: string; fromName: string; amount: number };
    	settlementDecided: {
    		id: string;
    		deciderName: string;
    		amount: number;
    		approved: boolean;
    		reason: string | null;
    	};
    };
    export type NotifyRequest<E extends PushEvent = PushEvent> = {
    	event: E;
    	actorId: string;
    	recipients: { userId: string; data: PushData[E] }[];
    };
    export type PushMessage = { title: string; body: string; url: string; tag: string };
    export type Prefs = Record<PushEvent, boolean>;
    export const PUSH_EVENTS: readonly PushEvent[];
    ```
  - `messages.ts`: `buildMessage<E extends PushEvent>(event: E, data: PushData[E], locale: Locale): PushMessage`
  - `notify.ts`:
    ```ts
    export type TargetRow = {
    	subscriptionId: string;
    	userId: string;
    	locale: string | null;
    } & PushTarget;
    export interface PushStore {
    	/** Subscriptions of these users who are active and have `event` enabled (missing pref row = enabled). */
    	targets(userIds: string[], event: PushEvent): Promise<TargetRow[]>;
    	remove(subscriptionIds: string[]): Promise<void>;
    	markSuccess(subscriptionIds: string[], at: Date): Promise<void>;
    }
    export function vapidFromEnv(env: {
    	VAPID_PUBLIC_KEY?: string;
    	VAPID_PRIVATE_KEY?: string;
    	VAPID_SUBJECT?: string;
    }): Vapid | null;
    export function notify(
    	store: PushStore,
    	vapid: Vapid | null,
    	req: NotifyRequest,
    	deps?: { send?: typeof sendWebPush; now?: () => Date }
    ): Promise<void>;
    ```
  - `store.ts`: `d1PushStore(db: Db): PushStore`

- [ ] **Step 1: Add i18n keys** to `bn.ts` and `en.ts`:

| key                                  | en                                               | bn                                                |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| `push.dayOpened.title`               | Breakfast is open                                | আজ খাবেন?                                         |
| `push.dayOpened.body`                | Will you eat today? Order now                    | নাস্তার অর্ডার চলছে, এখনই জানান                   |
| `push.dayFinalized.title`            | Today's bill                                     | আজকের বিল                                         |
| `push.dayFinalized.body`             | Your charge: {amount}                            | আপনার খরচ: {amount}                               |
| `push.settlementPending.title`       | Approve a settlement                             | একটি লেনদেন অনুমোদন করুন                          |
| `push.settlementPending.body`        | {name} → you {amount}, waiting for your approval | {name} → আপনি {amount}, আপনার অনুমোদনের অপেক্ষায় |
| `push.settlementApproved.title`      | Settlement approved                              | লেনদেন অনুমোদিত                                   |
| `push.settlementApproved.body`       | {name} approved {amount}                         | {name} {amount} অনুমোদন করেছেন                    |
| `push.settlementRejected.title`      | Settlement rejected                              | লেনদেন প্রত্যাখ্যাত                               |
| `push.settlementRejected.body`       | {name} rejected {amount}                         | {name} {amount} প্রত্যাখ্যান করেছেন               |
| `push.settlementRejected.bodyReason` | {name} rejected {amount}: {reason}               | {name} {amount} প্রত্যাখ্যান করেছেন: {reason}     |

- [ ] **Step 2: Write failing `messages.test.ts`**

```ts
it('dayOpened links home, tagged by date', () => {
	expect(buildMessage('dayOpened', { date: '2026-11-09' }, 'en')).toEqual({
		title: 'Breakfast is open',
		body: 'Will you eat today? Order now',
		url: '/',
		tag: 'day-2026-11-09'
	});
});
it('dayFinalized formats the charge per locale', () => {
	const en = buildMessage('dayFinalized', { date: '2026-11-09', charge: 8500 }, 'en');
	expect(en).toMatchObject({ url: '/ledger', tag: 'bill-2026-11-09' });
	expect(en.body).toBe(`Your charge: ${formatTaka(8500, 'en')}`);
	expect(buildMessage('dayFinalized', { date: '2026-11-09', charge: 8500 }, 'bn').body).toBe(
		`আপনার খরচ: ${formatTaka(8500, 'bn')}`
	);
});
it('settlementPending names the payer and links to the ledger', () => {
	expect(
		buildMessage('settlementPending', { id: 's1', fromName: 'Rahim', amount: 20000 }, 'en')
	).toMatchObject({
		url: '/ledger',
		tag: 'settlement-s1',
		body: `Rahim → you ${formatTaka(20000, 'en')}, waiting for your approval`
	});
});
it('settlementDecided approved / rejected with and without reason', () => {
	// approved → title 'Settlement approved', body 'Karim approved ৳…'
	// rejected, reason null → 'Karim rejected ৳…'
	// rejected, reason 'not yet' → 'Karim rejected ৳…: not yet'
	// all: url '/ledger', tag 'settlement-<id>'
});
```

- [ ] **Step 3: Run it, expect FAIL.** Run: `bun run test src/lib/server/push/messages.test.ts`
- [ ] **Step 4: Implement `events.ts` and `messages.ts`.** `PUSH_EVENTS = ['dayOpened', 'dayFinalized', 'settlementPending', 'settlementDecided']`.
- [ ] **Step 5: Run it, expect PASS.**

- [ ] **Step 6: Write failing `notify.test.ts`** with a fake `PushStore` (records calls, returns fixed rows) and a fake `send` (maps endpoint → status, or throws):

```ts
it('sends nothing when vapid is null', ...)                 // send never called, store.targets never called
it('drops the actor before querying', ...)                   // recipients [actor, u2] → targets called with ['u2']
it('does nothing when no recipients remain', ...)            // recipients [actor] → targets not called
it('builds each message in the recipient locale', ...)        // rows u1 'bn', u2 null → payload titles 'আজ খাবেন?' and 'আজ খাবেন?' (null → bn)
it('uses recipient-specific data', ...)                      // dayFinalized u1 charge 100, u2 charge 200 → each payload body has its own amount
it('removes 404/410 subscriptions and marks 2xx success', ...) // statuses 201, 410, 404 → remove(['s2','s3']), markSuccess(['s1'], now)
it('keeps rows and resolves on 500 or a thrown send, and still sends the rest', ...) // [500, throw, 201] → remove not called with s1/s2, markSuccess(['s3']), promise resolves
it('never rejects when the store throws', ...)               // targets() rejects → notify resolves
it('uses urgency high only for dayOpened', ...)              // opts passed to send
```

The payload passed to `send` is `JSON.stringify(PushMessage)`; tests parse it back.

```ts
it('vapidFromEnv needs all three values', () => {
	expect(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' })).toBeNull();
	expect(
		vapidFromEnv({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x' })
	).toBeNull();
	expect(
		vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x' })
	).toEqual({ publicKey: 'a', privateKey: 'b', subject: 'mailto:x' });
});
```

- [ ] **Step 7: Run it, expect FAIL.** Run: `bun run test src/lib/server/push/notify.test.ts`
- [ ] **Step 8: Implement `notify.ts`.** Locale: `isLocale(row.locale) ? row.locale : 'bn'`. Wrap the whole body in try/catch; on any failure log `console.warn('[push]', …)` with the endpoint origin and status only (never keys or the full endpoint). Use `Promise.allSettled`. Call `remove` and `markSuccess` only with non-empty lists.
- [ ] **Step 9: Run it, expect PASS.**
- [ ] **Step 10: Implement `store.ts`.** `targets`: select from `pushSubscription` inner join `user` (`user.active = true`, `user.id in userIds`) left join `notificationPref`; keep rows where the pref column for `event` is null or true. Map the event to the column with a `Record<PushEvent, Column>` object. Return `[]` for an empty `userIds` without querying. `remove`: delete by `inArray(id)`. `markSuccess`: update `lastSuccessAt`.
- [ ] **Step 11: Verify.** Run: `bun run test && bun run check`. Expected: pass.
- [ ] **Step 12: Commit**

```bash
git add src/lib/server/push src/lib/i18n
git commit -m "Push: localized messages and notify with dead-subscription cleanup"
```

---

### Task 4: Fire notifications from the four actions

**Files:**

- Create: `src/lib/server/push/index.ts`
- Create: `src/lib/server/push/recipients.ts`, `src/lib/server/push/recipients.test.ts`
- Modify: `src/routes/(app)/manage/+page.server.ts` (`start` ~L249, `finalize` ~L471)
- Modify: `src/routes/(app)/ledger/+page.server.ts` (`record` ~L169, `approve` ~L245, `reject` ~L272)

**Interfaces:**

- Consumes: `notify`, `vapidFromEnv` (Task 3), `d1PushStore` (Task 3), `NotifyRequest`, `PushData` (Task 3), `chargesForDay(db, dayId): Promise<Map<string, Poisha>>` (`#lib/server/charges.ts`).
- Produces:
  - `index.ts`: `queueNotify(event: { locals: App.Locals; platform?: App.Platform }, req: NotifyRequest | (() => Promise<NotifyRequest>)): void`. It reads `env` from `cloudflare:workers` (same as `hooks.server.ts`), resolves `req` (calling it if it is a function; a rejection is caught and logged), runs `notify(d1PushStore(locals.db), vapidFromEnv(env), resolved)`, and passes that promise to `platform.ctx.waitUntil`. With no `ctx`, it does `void promise`.
  - `recipients.ts` (pure):
    - `pendingRecipient(s: { id: string; toUserId: string; amount: number; status: string }, fromName: string): NotifyRequest<'settlementPending'>['recipients']`: one recipient (`toUserId`) when `status === 'pending'`, else `[]`.
    - `decidedRecipient(s: { id: string; createdBy: string; amount: number }, deciderName: string, approved: boolean, reason: string | null): NotifyRequest<'settlementDecided'>['recipients']`: one recipient, `createdBy`.
    - `finalizedRecipients(charges: Map<string, number>, date: string): NotifyRequest<'dayFinalized'>['recipients']`: one per map entry.

- [ ] **Step 1: Write failing `recipients.test.ts`**

```ts
it('pending: notifies the receiver only while pending', () => {
	expect(
		pendingRecipient({ id: 's1', toUserId: 'A', amount: 5000, status: 'pending' }, 'B')
	).toEqual([{ userId: 'A', data: { id: 's1', fromName: 'B', amount: 5000 } }]);
	expect(
		pendingRecipient({ id: 's1', toUserId: 'A', amount: 5000, status: 'approved' }, 'B')
	).toEqual([]);
});
it('decided: notifies whoever recorded it (a manager, not the payer)', () => {
	expect(
		decidedRecipient({ id: 's1', createdBy: 'M', amount: 5000 }, 'A', false, 'not received')
	).toEqual([
		{
			userId: 'M',
			data: { id: 's1', deciderName: 'A', amount: 5000, approved: false, reason: 'not received' }
		}
	]);
});
it('finalized: one recipient per charged member with their own charge', () => {
	expect(
		finalizedRecipients(
			new Map([
				['u1', 8500],
				['u2', 4250]
			]),
			'2026-11-09'
		)
	).toEqual([
		{ userId: 'u1', data: { date: '2026-11-09', charge: 8500 } },
		{ userId: 'u2', data: { date: '2026-11-09', charge: 4250 } }
	]);
});
```

- [ ] **Step 2: Run it, expect FAIL.** Then implement `recipients.ts`, run it, expect PASS.
- [ ] **Step 3: Implement `index.ts`.**
- [ ] **Step 4: Wire `manage.start`.** After the successful `db.batch`, select `user.id` where `active = true` and call `queueNotify(event, { event: 'dayOpened', actorId: me.id, recipients: ids.map((userId) => ({ userId, data: { date: dhakaToday() } })) })`. Change the action signature to take the whole `event` (`async (event) => { const { locals, request } = event; … }`) or destructure `platform` too, whichever matches the file. Do **not** add this to `reopenOrders`.
- [ ] **Step 5: Wire `manage.finalize`.** After `runBatch` succeeds, queue `dayFinalized`. Pass the function form so the charges query runs inside `waitUntil`, not in the response path: `queueNotify(event, async () => ({ event: 'dayFinalized', actorId: me.id, recipients: finalizedRecipients(await chargesForDay(db, today.id), today.date) }))`.
- [ ] **Step 6: Wire `ledger.record`.** Change `insert(...)` to `.returning({ id: settlement.id })`. When `status === 'pending'`, look up the `fromUserId` user's `name` and queue `settlementPending` with `pendingRecipient(...)`, `actorId: me.id`. When the payer records their own payment the actor is the payer, and the receiver is notified.
- [ ] **Step 7: Wire `ledger.approve` and `ledger.reject`.** After the audit insert, queue `settlementDecided` with `decidedRecipient(row, me.name, approved, reason.value ?? null)`, `actorId: me.id`. (If the receiver recorded it themselves the row is never pending, so `createdBy === me` cannot happen here, and the actor filter covers it anyway.)
- [ ] **Step 8: Verify.** Run: `bun run test && bun run check && bun run lint`. Expected: pass.
- [ ] **Step 9: Manual smoke (server side).** Generate keys (`bun scripts/vapid-keys.ts`), put them in `.env`, run `bun run dev`, start a day as a manager. Expected: the action succeeds, and with no subscriptions there are no `[push]` warnings in the terminal.
- [ ] **Step 10: Commit**

```bash
git add src/lib/server/push "src/routes/(app)/manage/+page.server.ts" "src/routes/(app)/ledger/+page.server.ts"
git commit -m "Push: notify on day open, finalize, and settlement pending/decided"
```

---

### Task 5: PWA manifest, icons and service worker

**Files:**

- Create: `static/manifest.webmanifest`, `static/icons/icon-192.png`, `static/icons/icon-512.png`, `static/icons/icon-maskable-512.png`, `static/icons/badge-96.png`
- Create: `static/sw.js`
- Modify: `src/app.html`

**Interfaces:**

- Produces: service worker at `/sw.js` (scope `/`). It expects a push payload of JSON `PushMessage` `{ title, body, url, tag }` (Task 3).

- [ ] **Step 1: Generate icons** from `src/lib/assets/favicon.svg` with ImageMagick (installed at `/usr/bin/magick`):

```bash
mkdir -p static/icons
magick -background none -density 512 src/lib/assets/favicon.svg -resize 192x192 static/icons/icon-192.png
magick -background none -density 512 src/lib/assets/favicon.svg -resize 512x512 static/icons/icon-512.png
# maskable: logo at 80% on the light theme background #f6f7f2
magick -background '#f6f7f2' -density 512 src/lib/assets/favicon.svg -resize 410x410 -gravity center -extent 512x512 static/icons/icon-maskable-512.png
# badge: monochrome white on transparent
magick -background none -density 512 src/lib/assets/favicon.svg -resize 96x96 -alpha extract -background white -alpha shape static/icons/badge-96.png
```

Expected: four PNGs. Open them and check the logo is not clipped.

- [ ] **Step 2: Write `manifest.webmanifest`**: `name` "কে খাবে", `short_name` "কে খাবে", `start_url` "/", `scope` "/", `display` "standalone", `background_color` and `theme_color` "#f6f7f2", the three icons (maskable with `"purpose": "maskable"`).
- [ ] **Step 3: Update `app.html`** with `<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />`, `<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/icon-192.png" />` and `<meta name="apple-mobile-web-app-capable" content="yes" />`.
- [ ] **Step 4: Write `static/sw.js`** with no caching:
  - `install` → `self.skipWaiting()`; `activate` → `event.waitUntil(self.clients.claim())`.
  - `push`: `const m = event.data?.json() ?? {}`; `event.waitUntil(self.registration.showNotification(m.title ?? 'কে খাবে', { body: m.body, tag: m.tag, renotify: Boolean(m.tag), icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: m.url ?? '/' } }))`. Wrap the `json()` in try/catch and fall back to the text as the body.
  - `notificationclick`: `notification.close()`. Find a `window` client with the same origin, then `focus()` and `navigate(url)`; otherwise `clients.openWindow(url)`.
- [ ] **Step 5: Verify.** Run `bun run build && bun run preview` and open `http://localhost:4173`. In DevTools → Application: the manifest loads with no errors and the icons show.
- [ ] **Step 6: Commit**

```bash
git add static src/app.html
git commit -m "PWA manifest, icons and push service worker"
```

---

### Task 6: `Switch` primitive, `/notifications` page, client helpers

**Files:**

- Create: `src/lib/components/ui/Switch.svelte`; modify `src/lib/components/ui/index.ts`, `src/routes/ui/+page.svelte` (gallery entry)
- Create: `src/lib/push/client.ts`
- Create: `src/lib/server/push/subscriptions.ts`, `src/lib/server/push/subscriptions.test.ts`
- Create: `src/routes/(app)/notifications/+page.server.ts`, `src/routes/(app)/notifications/+page.svelte`
- Modify: `src/lib/components/shell/AccountMenu.svelte`
- Modify: `src/lib/i18n/bn.ts`, `src/lib/i18n/en.ts` (`notifications.*`, `account.notifications`)

**Interfaces:**

- Consumes: `pushSubscription`, `notificationPref` (Task 2); `PUSH_EVENTS`, `Prefs` (Task 3); `vapidFromEnv` (Task 3); `/sw.js` (Task 5).
- Produces:
  - `Switch.svelte` props: `checked: boolean` (bindable), `label: string`, `description?: string`, `name?: string` (renders a hidden input with `value="on"` when checked, for form posts), `disabled?: boolean`. Renders `<button role="switch" aria-checked>` with a visible label.
  - `subscriptions.ts` (pure):
    - `parseSubscriptionForm(form: FormData): { ok: true; value: { endpoint: string; p256dh: string; auth: string } } | { ok: false }`. The endpoint must be `https:` and at most 1024 characters; `p256dh` must decode to 65 bytes and `auth` to 16.
    - `upsertSubscriptionValues(userId: string, sub, userAgent: string | null)` returns `{ insert, onConflictSet }` for `onConflictDoUpdate({ target: pushSubscription.endpoint, set })`. `set` contains `userId`, `p256dh`, `auth`, `userAgent`.
    - `parsePrefsForm(form: FormData): Prefs`: each event is `form.get(event) === 'on'`.
  - `client.ts`:
    - `type PushSupport = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted'`
    - `pushSupport(): PushSupport`: `unsupported` when `serviceWorker`, `PushManager` or `Notification` is missing, except on iOS/iPadOS not in standalone mode (`navigator.standalone !== true` and `!matchMedia('(display-mode: standalone)').matches`), which returns `needs-install`. Otherwise `Notification.permission`.
    - `currentSubscription(): Promise<PushSubscription | null>`
    - `enablePush(publicKey: string): Promise<'on' | 'denied' | 'error'>`: register `/sw.js`, `Notification.requestPermission()`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDecode(publicKey) })`, then POST `FormData{endpoint,p256dh,auth}` to `/notifications?/subscribe` and check the result with `deserialize` from `$app/forms`. If the POST fails, call `sub.unsubscribe()` and return `'error'`.
    - `disablePush(): Promise<void>`: POST the endpoint to `/notifications?/unsubscribe`, then `sub.unsubscribe()`.
    - Uses its own small base64url decode (do not import from `src/lib/server`).
  - Page `load` returns `{ vapidPublicKey: string | null, prefs: Prefs }` (all true when there is no row).
  - Actions: `subscribe`, `unsubscribe` (`delete … where endpoint = ? and userId = me`), `savePrefs` (upsert `notificationPref` on `userId`), each returning `{ saved: true }` or `fail(400)`.

- [ ] **Step 1: Write failing `subscriptions.test.ts`**

```ts
it('accepts a well-formed subscription', ...)            // https endpoint, 65-byte p256dh, 16-byte auth → ok
it('rejects http endpoints, bad key lengths, missing fields', ...)
it('upsert moves an existing endpoint to the new user', () => {
	const v = upsertSubscriptionValues('u2', { endpoint: 'https://p/x', p256dh: 'P', auth: 'A' }, 'UA');
	expect(v.insert).toMatchObject({ userId: 'u2', endpoint: 'https://p/x', p256dh: 'P', auth: 'A', userAgent: 'UA' });
	expect(v.onConflictSet).toEqual({ userId: 'u2', p256dh: 'P', auth: 'A', userAgent: 'UA' });
});
it('parsePrefsForm: unchecked switches are false', () => {
	const f = new FormData(); f.set('dayOpened', 'on'); f.set('settlementDecided', 'on');
	expect(parsePrefsForm(f)).toEqual({ dayOpened: true, dayFinalized: false, settlementPending: false, settlementDecided: true });
});
```

- [ ] **Step 2: Run, expect FAIL. Implement `subscriptions.ts`. Run, expect PASS.**
- [ ] **Step 3: Build `Switch.svelte`** following the existing primitives (check `SegmentedControl.svelte` for token and focus-ring classes). Export it from `index.ts` and add it to the `/ui` gallery as on, off and disabled examples.
- [ ] **Step 4: Add i18n keys** (bn and en). At minimum: `account.notifications` (Notifications / নোটিফিকেশন), `notifications.title`, `notifications.device.title` (This device), `notifications.device.on`, `.off`, `.blocked`, `.blockedHelp` (allow notifications for this site in the browser's site settings, then reload), `.needsInstall`, `.installHelp` (iPhone: Share → Add to Home Screen, then open from the home screen), `.unsupported`, `.unavailable` (no VAPID key), `notifications.turnOn`, `notifications.turnOff`, `notifications.error`, `notifications.prefs.title` (What to notify me about), and a label plus description for each event: `notifications.prefs.dayOpened` (When breakfast opens), `.dayFinalized` (When today's bill is ready), `.settlementPending` (When a settlement waits for my approval), `.settlementDecided` (When my settlement is approved or rejected), `notifications.prefs.save`, `notifications.prefs.saved`.
- [ ] **Step 5: Write `client.ts`.**
- [ ] **Step 6: Write the page server** (`load` + three actions, all scoped to `locals.user!.id`, with `userAgent` from `request.headers.get('user-agent')?.slice(0, 200)`).
- [ ] **Step 7: Write the page.** It uses `PageHeader`, a `Card` for "This device" (state from `pushSupport()` + `currentSubscription()` in `onMount`, one `Button` for on/off, help text for blocked, needs-install and unsupported, and `unavailable` when `vapidPublicKey` is null), and a `Card` holding a `<form method="POST" action="?/savePrefs" use:enhance>` with four `Switch`es named after the events, plus Save with a saved `Alert`.
- [ ] **Step 8: Add the account menu link.** Add `<MenuItem href="/notifications">{i18n.t('account.notifications')}</MenuItem>` above the `Separator`/Logout (check how `MenuItem` takes `href`; use `resolve('/(app)/notifications')` like `TopBar`).
- [ ] **Step 9: Verify.** Run: `bun run test && bun run check && bun run lint`. Expected: pass.
- [ ] **Step 10: Manual check (Chrome desktop).** With keys in `.env`, run `bun run dev`, go to `/notifications` → Turn on → allow. Expected: a `push_subscription` row appears (`bun run db:studio`). In another browser profile, sign in as a manager and start the day: the first browser shows "Breakfast is open", and clicking it opens `/`. Switch off "When breakfast opens", save, reopen and restart: no push. Turn off: the row is gone.
- [ ] **Step 11: Commit**

```bash
git add src/lib/components/ui src/routes/ui src/lib/push src/lib/server/push "src/routes/(app)/notifications" src/lib/components/shell/AccountMenu.svelte src/lib/i18n
git commit -m "Notifications page: per-device opt-in and per-event preferences"
```

---

### Task 7: Today nudge

**Files:**

- Create: `src/lib/components/today/PushNudge.svelte`
- Modify: `src/routes/(app)/+page.server.ts` (`load` returns `vapidPublicKey`)
- Modify: `src/routes/(app)/+page.svelte` (render the nudge above the Today card)
- Modify: `src/lib/i18n/bn.ts`, `src/lib/i18n/en.ts` (`push.nudge.*`)

**Interfaces:**

- Consumes: `pushSupport`, `currentSubscription`, `enablePush` (Task 6); `vapidFromEnv` (Task 3).
- Produces: `<PushNudge publicKey={string | null} />`

- [ ] **Step 1: Add i18n keys** `push.nudge.text` (Get a notification when breakfast opens / নাস্তা শুরু হলে নোটিফিকেশন পান), `push.nudge.turnOn` (Turn on / চালু করুন), `push.nudge.dismiss` (Not now / এখন না), `push.nudge.denied` (Notifications are blocked in this browser / এই ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে).
- [ ] **Step 2: Build `PushNudge.svelte`.** Starts hidden; in `onMount` it shows only when `publicKey` is set, `pushSupport()` is `'default'` or `'granted'`, `currentSubscription()` is null, and `localStorage['ke-push-nudge'] !== 'dismissed'` (read and write in try/catch; a failed read counts as not dismissed). Turn on → `enablePush`; on `'on'` it hides; on `'denied'` it shows the denied line and stores the dismissal; on `'error'` it shows `notifications.error`. Not now → store `'dismissed'` and hide. Use `Card`/`Alert` + `Button` primitives, compact layout.
- [ ] **Step 3: Add `vapidPublicKey: vapidFromEnv(env)?.publicKey ?? null`** to the Today `load` (import `env` from `cloudflare:workers`), and render `<PushNudge publicKey={data.vapidPublicKey} />`.
- [ ] **Step 4: Verify.** Run: `bun run check && bun run lint && bun run test`. Expected: pass.
- [ ] **Step 5: Manual check.** In a fresh browser profile the nudge shows on Today. "Not now" hides it and it stays hidden after reload. In another profile "Turn on" subscribes and the card disappears, and `/notifications` then shows "On".
- [ ] **Step 6: Commit**

```bash
git add src/lib/components/today/PushNudge.svelte "src/routes/(app)/+page.server.ts" "src/routes/(app)/+page.svelte" src/lib/i18n
git commit -m "Today: nudge to turn on notifications"
```

---

### Task 8: Docs and end-to-end check

**Files:**

- Modify: `docs/REQUIREMENTS.md` (L66–75), `README.md`

- [ ] **Step 1: Update `REQUIREMENTS.md`.** Change "Out of scope" to read `Email or SMS notifications`. Add a `## Notifications` section listing the four events, per-event choice per member, per-device opt-in, iPhone needing the installed app, and that a failed push never blocks an action.
- [ ] **Step 2: Update `README.md`.** In Setup, add the VAPID values (`bun scripts/vapid-keys.ts`, `VAPID_SUBJECT="mailto:<admin>"`). In Deploying step 3, add `wrangler secret put VAPID_PUBLIC_KEY` (and `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) plus `bun run db:migrate:remote` for the new migration.
- [ ] **Step 3: Full verification.** Run: `bun run test && bun run check && bun run lint && bun run build`. Expected: all pass.
- [ ] **Step 4: End-to-end manual run.** Use two browsers (or Chrome + Android phone via a tunnel such as `wrangler dev --remote` or a deployed preview URL; push needs HTTPS off localhost). Trigger each event and tap each notification:
  - day opened → opens `/`
  - finalize → "Today's bill" with the right amount → `/ledger`
  - member B records "B paid A" → A gets "Approve a settlement" → `/ledger`
  - A rejects with a reason → B gets "Settlement rejected: <reason>"
  - reopen day + finalize again → the bill notification is replaced, not duplicated
  - iPhone: installed PWA → Turn on → receives "Breakfast is open"
- [ ] **Step 5: Commit**

```bash
git add docs/REQUIREMENTS.md README.md
git commit -m "Docs: web push notifications"
```
