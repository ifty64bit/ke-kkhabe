import { b64uDecode, b64uEncode, type Bytes } from './base64url.ts';

export type Vapid = { publicKey: string; privateKey: string; subject: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

type ServerKey = { publicKey: string; privateKey: string };
type Urgency = 'very-low' | 'low' | 'normal' | 'high';

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
const MAX_PLAINTEXT = 3993;

function concat(...parts: Uint8Array[]): Bytes {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** P-256 keys cross WebCrypto as JWK; raw public keys are X9.62 uncompressed (0x04 || x || y). */
function rawToJwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
	if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new Error('Invalid P-256 public key');
	return {
		kty: 'EC',
		crv: 'P-256',
		x: b64uEncode(publicKey.slice(1, 33)),
		y: b64uEncode(publicKey.slice(33, 65)),
		...(privateKey ? { d: b64uEncode(privateKey) } : {})
	};
}

async function importEcdhPrivate(publicKey: string, privateKey: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'jwk',
		rawToJwk(b64uDecode(publicKey), b64uDecode(privateKey)),
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		['deriveBits']
	);
}

async function deriveKey(ikm: Bytes, salt: Bytes, info: Bytes, bits: number): Promise<Bytes> {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits)
	);
}

/**
 * Encrypt a push payload per RFC 8291 (aes128gcm, one record, record size 4096).
 * Returns the complete body: salt || rs || idlen || server public key || ciphertext.
 */
export async function encryptPayload(
	plaintext: Uint8Array,
	target: Pick<PushTarget, 'p256dh' | 'auth'>,
	opts: { salt?: Uint8Array; serverKey?: ServerKey } = {}
): Promise<Bytes> {
	if (plaintext.length > MAX_PLAINTEXT)
		throw new Error(`Push payload too large (${plaintext.length} > ${MAX_PLAINTEXT})`);
	const uaPublic = b64uDecode(target.p256dh);
	const authSecret = b64uDecode(target.auth);
	if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('Invalid p256dh');
	if (authSecret.length !== 16) throw new Error('Invalid auth secret');

	let serverPublicBytes: Uint8Array;
	let serverPrivateKey: CryptoKey;
	if (opts.serverKey) {
		serverPublicBytes = b64uDecode(opts.serverKey.publicKey);
		serverPrivateKey = await importEcdhPrivate(opts.serverKey.publicKey, opts.serverKey.privateKey);
	} else {
		const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
			'deriveBits'
		]);
		serverPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
		const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
		serverPrivateKey = await crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			['deriveBits']
		);
	}

	const uaPublicKey = await crypto.subtle.importKey(
		'raw',
		uaPublic,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const ecdhSecret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, serverPrivateKey, 256)
	);

	const keyInfo = concat(
		encoder.encode('WebPush: info'),
		new Uint8Array([0]),
		uaPublic,
		serverPublicBytes
	);
	const ikm = await deriveKey(ecdhSecret, authSecret, keyInfo, 256);

	const salt: Bytes = opts.salt
		? new Uint8Array(opts.salt)
		: crypto.getRandomValues(new Uint8Array(16));
	if (salt.length !== 16) throw new Error('Invalid salt');
	const cek = await deriveKey(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 128);
	const nonce = await deriveKey(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 96);

	const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: nonce },
			aesKey,
			concat(plaintext, new Uint8Array([0x02]))
		)
	);

	const recordSize = new Uint8Array([
		(RECORD_SIZE >>> 24) & 0xff,
		(RECORD_SIZE >>> 16) & 0xff,
		(RECORD_SIZE >>> 8) & 0xff,
		RECORD_SIZE & 0xff
	]);
	return concat(
		salt,
		recordSize,
		new Uint8Array([serverPublicBytes.length]),
		serverPublicBytes,
		ciphertext
	);
}

/** ES256 VAPID authorization header (RFC 8292) for the endpoint's origin. */
export async function vapidAuthorization(
	endpoint: string,
	vapid: Vapid,
	now = Date.now()
): Promise<string> {
	const header = b64uEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const claims = b64uEncode(
		encoder.encode(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				exp: Math.floor(now / 1000) + 12 * 3600,
				sub: vapid.subject
			})
		)
	);
	const key = await crypto.subtle.importKey(
		'jwk',
		rawToJwk(b64uDecode(vapid.publicKey), b64uDecode(vapid.privateKey)),
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			key,
			encoder.encode(`${header}.${claims}`)
		)
	);
	return `vapid t=${header}.${claims}.${b64uEncode(signature)}, k=${vapid.publicKey}`;
}

/** Send one encrypted push message. Non-2xx statuses are returned, not thrown. */
export async function sendWebPush(
	target: PushTarget,
	payload: string,
	vapid: Vapid,
	opts: { ttl?: number; urgency?: Urgency; fetch?: typeof fetch } = {}
): Promise<{ status: number }> {
	const body = await encryptPayload(encoder.encode(payload), target);
	const authorization = await vapidAuthorization(target.endpoint, vapid);
	const response = await (opts.fetch ?? globalThis.fetch)(target.endpoint, {
		method: 'POST',
		headers: {
			Authorization: authorization,
			TTL: String(opts.ttl ?? 86400),
			Urgency: opts.urgency ?? 'normal',
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream'
		},
		body
	});
	return { status: response.status };
}
