# Web push notifications: design

Date: 2026-11-09 · Status: approved in chat, pending spec review

## Problem

Members find out that breakfast is open, what they owe, or that a settlement waits for them
only by opening the app. Orders get missed and pending settlements sit unapproved.

## Goal and success criteria

- A member who has turned notifications on gets a push on their phone or desktop when:
  1. the manager opens today ("আজ খাবেন?"),
  2. today is finalized (with their own charge),
  3. a settlement where they are the receiver is waiting for their approval,
  4. a settlement they recorded is approved or rejected.
- Each member chooses, per event, whether they want it. The choice applies to all their devices.
- Each device is turned on or off on its own.
- Works on Android and desktop browsers, and on iPhone when the app is installed to the home
  screen (iOS 16.4+).
- A failed push never fails or slows the action that caused it.

## Non-goals

- Firebase / FCM, native apps.
- Email or SMS.
- Offline support or caching in the service worker.
- Scheduled reminders ("you haven't ordered yet"), cutoff times.
- Retrying failed sends or a send queue.

## Approach

Standard Web Push (RFC 8030) with VAPID (RFC 8292) and `aes128gcm` payload encryption
(RFC 8291), written as a small dependency-free module on WebCrypto so it runs natively on
Cloudflare Workers. The `web-push` Node package is not used (it relies on Node `https` and
`crypto` internals).

## Data model

Two new D1 tables in `src/lib/server/db/schema.ts`, with a Drizzle migration.

```
push_subscription
  id            text pk
  user_id       text → user.id, on delete cascade
  endpoint      text, unique
  p256dh        text            -- base64url, from the browser
  auth          text            -- base64url, from the browser
  user_agent    text, nullable  -- for the device list / debugging
  created_at    timestamp_ms
  last_success_at timestamp_ms, nullable
  index (user_id)

notification_pref
  user_id             text pk → user.id, on delete cascade
  day_opened          boolean, default true
  day_finalized       boolean, default true
  settlement_pending  boolean, default true
  settlement_decided  boolean, default true
```

- A missing `notification_pref` row means every event is on.
- Preferences belong to the user; a subscription belongs to one device of that user.
- Subscribing with an endpoint that already exists updates that row (user, keys, user agent).
  This covers a device whose browser is now signed in as someone else.

## Configuration

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (base64url, P-256) and `VAPID_SUBJECT`
  (`mailto:` address) in `.env.example`, `wrangler types`, and as wrangler secrets in
  production.
- `scripts/vapid-keys.ts` (run with `bun`) prints a fresh key pair. README documents it.
- The public key reaches the browser through the `/notifications` and Today page loads (not
  a `PUBLIC_` env import), so it lives only in the Worker env.

## Units

### `src/lib/server/push/webpush.ts`: protocol only, no DB

- `sendWebPush(sub: { endpoint, p256dh, auth }, payload: string, vapid: Vapid, opts?: { ttl?, urgency? }): Promise<{ status: number }>`
- VAPID: ES256 JWT, `aud` = origin of the endpoint, `exp` = now + 12h, `sub` =
  `VAPID_SUBJECT`. Header `Authorization: vapid t=<jwt>, k=<public key>`.
- Encryption per RFC 8291: fresh ephemeral P-256 key pair and 16-byte salt per message,
  ECDH with the subscription's `p256dh`, HKDF with `auth`, AES-128-GCM, single record,
  record size 4096. Headers `Content-Encoding: aes128gcm`, `Content-Type:
application/octet-stream`, `TTL` (default 86400), `Urgency` (default `normal`).
- Returns the push service's HTTP status. It throws only on malformed input (bad keys), never
  on a non-2xx response.
- Internals (`encrypt`, `vapidHeader`) are exported for tests, with injectable ephemeral key
  and salt.

### `src/lib/server/push/messages.ts`: what each push says

- `buildMessage(event, data, locale): { title, body, url, tag }`, pure.
- Strings live in `src/lib/i18n/bn.ts` and `en.ts` under `push.*`. Amounts are formatted with
  the existing money formatter for that locale (৳, Bangla digits in `bn`).

| Event               | Title (en)                     | Body (en)                                         | url       | tag               |
| ------------------- | ------------------------------ | ------------------------------------------------- | --------- | ----------------- |
| `dayOpened`         | Breakfast is open              | Will you eat today? Order now                     | `/`       | `day-<date>`      |
| `dayFinalized`      | Today's bill                   | Your charge: ৳85                                  | `/ledger` | `bill-<date>`     |
| `settlementPending` | Approve a settlement           | Rahim → you ৳200, waiting for your approval       | `/ledger` | `settlement-<id>` |
| `settlementDecided` | Settlement approved / rejected | Karim approved ৳200 / Karim rejected ৳200: reason | `/ledger` | `settlement-<id>` |

The Bangla strings are written alongside the English ones in the same change.

### `src/lib/server/push/notify.ts`: who gets what

- `notify(store: PushStore, vapid, { event, actorId, recipients: { userId, data }[] }): Promise<void>`; `PushStore` (loading targets, removing and marking subscriptions) is injected so `notify` is unit-testable, and `d1PushStore(db)` is the D1 implementation
  1. Removes `actorId` from the recipients (nobody is notified about their own action).
  2. Loads subscriptions for the remaining users, joined to `user` where `active = true`,
     left-joined to `notification_pref`; drops users whose preference for `event` is off.
  3. Builds each user's message in that user's `locale` (`user.locale`, default `bn`).
  4. Sends all with `Promise.allSettled`. `dayOpened` uses `Urgency: high`.
  5. 404 or 410 deletes that subscription. 2xx sets `last_success_at`. Anything else, or a
     thrown error, gets one `console.warn` (endpoint origin + status, never keys).
- Never throws to the caller.
- `vapidFromEnv(env)` returns the VAPID config, or `null` if the keys are not set. With
  `null`, `notify` does nothing (local dev without keys still works).

### Triggers (existing actions)

Each one runs `platform.ctx.waitUntil(notify(...))` after its DB write has succeeded and
before returning. The action's response does not wait for the sends.

| Event               | Action                                             | Recipients                       | data                                            |
| ------------------- | -------------------------------------------------- | -------------------------------- | ----------------------------------------------- |
| `dayOpened`         | `manage` → `start`                                 | all active users                 | `{ date }`                                      |
| `dayFinalized`      | `manage` → `finalize`                              | each user with a charge that day | `{ date, charge }`                              |
| `settlementPending` | `ledger` → `record`, only when status is `pending` | `toUserId`                       | `{ id, fromName, amount }`                      |
| `settlementDecided` | `ledger` → `approve` / `reject`                    | `createdBy` of the settlement    | `{ id, deciderName, amount, approved, reason }` |

- `start` creates the day directly as `open` and only once per date, so `dayOpened` fires
  once a day. `reopenOrders` does not notify.
- Finalizing again after `reopenDay` sends `dayFinalized` again with the new charge; the same
  `tag` replaces the earlier notification on the device.

## Browser side

### PWA minimum

- `static/manifest.webmanifest`: name, short name, `start_url: /`, `display: standalone`,
  theme and background colours matching `app.html`, icons.
- PNG icons 192, 512 and maskable 512 in `static/icons/`, made from
  `src/lib/assets/favicon.svg`.
- `app.html`: `<link rel="manifest">` and `<link rel="apple-touch-icon">`.

### `static/sw.js`

Plain service worker, registered with `scope: '/'`. No caching.

- `push`: parse JSON `{ title, body, url, tag }`, `showNotification(title, { body, tag,
icon, badge, data: { url } })`.
- `notificationclick`: close it; focus an open window of the app and navigate it to `url`,
  else `clients.openWindow(url)`.

### `src/lib/push/client.ts`

- `pushSupport(): 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted'`
  (`needs-install`: iOS/iPadOS Safari not running standalone).
- `currentSubscription(): Promise<PushSubscription | null>`
- `subscribe(publicKey)`: register `sw.js`, request permission, `pushManager.subscribe({
userVisibleOnly: true, applicationServerKey })`, then POST to `/notifications?/subscribe`
  (an absolute action URL, so the Today nudge uses the same action).
- `unsubscribe()`: `sub.unsubscribe()` and POST endpoint to `/notifications?/unsubscribe`.

## UI

All text through `useI18n` (bn + en), built from `src/lib/components/ui` primitives and
semantic tokens.

### New primitive: `Switch.svelte`

Accessible toggle (`role="switch"`, `aria-checked`, label, disabled state) in
`src/lib/components/ui`, exported from the index and shown in the `/ui` gallery.

### `/notifications` page (`src/routes/(app)/notifications/`)

- **This device** card: shows the state (on / off / blocked / needs install / not supported)
  and one button: Turn on or Turn off.
  - Blocked: how to allow notifications again in browser settings.
  - Needs install: Add to Home Screen steps for iPhone.
  - Not supported: a short note; the rest of the page still works.
- **What to notify me about**: four `Switch`es (day opened, day finalized, settlement waiting
  for me, my settlement approved or rejected), saved with `?/savePrefs`. Shown to every
  member, managers included.
- Form actions `subscribe`, `unsubscribe`, `savePrefs`, all scoped to `locals.user`.
  `unsubscribe` deletes only a row owned by the current user.
- Account menu gets a "Notifications" item above Logout.

### Today nudge

A small card on Today: "Get a notification when breakfast opens" with Turn on and Not now.
Hidden when push is unsupported, permission is denied, this device is already subscribed,
or it was dismissed. Dismissal is kept in `localStorage` (read and write wrapped in
try/catch); it is a per-device convenience only.

## Error handling

- Missing VAPID keys: `notify` is a no-op; the page shows Turn on as unavailable.
- Permission denied during subscribe: no server call; card switches to the blocked state.
- Subscribe POST fails: unsubscribe the browser side again so the two stay in step; show the
  existing error alert.
- Push service 404/410: subscription deleted. Other failures: logged, not retried.
- An inactive user keeps their rows but gets nothing; reactivating restores pushes.

## Testing

- `webpush.test.ts`: the RFC 8291 §5 example (fixed keys, salt and plaintext give the exact
  ciphertext); a VAPID JWT verifies against the public key and has the right `aud`, `exp`,
  `sub`.
- `messages.test.ts`: every event in bn and en; money formatting; reject with and without
  a reason.
- `notify.test.ts`: with fake DB rows and stubbed `fetch`: preference off skips the user;
  inactive user skipped; actor excluded; 410 deletes the row; 201 sets `last_success_at`;
  per-user locale; no VAPID config sends nothing; a thrown fetch does not reject `notify`.
- Manual: Chrome on Android and desktop, and an installed iPhone PWA; trigger each of the
  four events and tap each notification.

## Docs

- `docs/REQUIREMENTS.md`: move push out of "Out of scope"; add a short Notifications section
  listing the four events and per-event choice. Email and SMS stay out of scope.
- README: VAPID key generation and secrets.
