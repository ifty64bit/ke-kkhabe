/**
 * Generate a VAPID key pair for Web Push.
 *
 *   bun scripts/vapid-keys.ts
 *
 * Put the two values in `.env` (and as wrangler secrets in production), and set
 * `VAPID_SUBJECT` to a `mailto:` address.
 */
import { b64uEncode } from '../src/lib/server/push/base64url.ts';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
	'sign',
	'verify'
]);
const publicKey = b64uEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${jwk.d}"`);
