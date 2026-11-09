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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function generateTestVapid() {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
	const publicKey = b64uEncode(
		new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
	);
	const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
	return { publicKey, privateKey: jwk.d! };
}

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
			encoder.encode(RFC.plaintext),
			{ p256dh: RFC.uaPublic, auth: RFC.auth },
			{
				salt: b64uDecode(RFC.salt),
				serverKey: { publicKey: RFC.asPublic, privateKey: RFC.asPrivate }
			}
		);
		expect(b64uEncode(out)).toBe(RFC.body);
	});

	it('rejects oversized plaintext and malformed keys', async () => {
		await expect(
			encryptPayload(new Uint8Array(3994), { p256dh: RFC.uaPublic, auth: RFC.auth })
		).rejects.toThrow();
		await expect(
			encryptPayload(encoder.encode('x'), {
				p256dh: b64uEncode(new Uint8Array(64)),
				auth: RFC.auth
			})
		).rejects.toThrow();
		await expect(
			encryptPayload(encoder.encode('x'), {
				p256dh: RFC.uaPublic,
				auth: b64uEncode(new Uint8Array(15))
			})
		).rejects.toThrow();
	});
});

describe('vapidAuthorization', () => {
	it('signs an ES256 JWT for the endpoint origin that verifies with the public key', async () => {
		const keys = await generateTestVapid();
		const now = 1_800_000_000_000;
		const header = await vapidAuthorization(
			'https://fcm.googleapis.com/fcm/send/abc',
			{ ...keys, subject: 'mailto:a@b.c' },
			now
		);
		const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
		expect(k).toBe(keys.publicKey);
		const [h, p, s] = jwt.split('.');
		expect(JSON.parse(decoder.decode(b64uDecode(h)))).toEqual({
			typ: 'JWT',
			alg: 'ES256'
		});
		expect(JSON.parse(decoder.decode(b64uDecode(p)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: Math.floor(now / 1000) + 12 * 3600,
			sub: 'mailto:a@b.c'
		});
		const verifyKey = await crypto.subtle.importKey(
			'raw',
			b64uDecode(keys.publicKey),
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
		expect(
			await crypto.subtle.verify(
				{ name: 'ECDSA', hash: 'SHA-256' },
				verifyKey,
				b64uDecode(s),
				encoder.encode(`${h}.${p}`)
			)
		).toBe(true);
	});
});

describe('sendWebPush', () => {
	const target = {
		endpoint: 'https://push.example.net/send/abc',
		p256dh: RFC.uaPublic,
		auth: RFC.auth
	};

	it('POSTs the encrypted body with the required headers and returns the status', async () => {
		const keys = await generateTestVapid();
		const calls: { url: string; init: RequestInit }[] = [];
		const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(url), init: init! });
			return new Response(null, { status: 201 });
		}) as typeof fetch;

		const result = await sendWebPush(
			target,
			'hello',
			{ ...keys, subject: 'mailto:a@b.c' },
			{ fetch: fakeFetch }
		);

		expect(result).toEqual({ status: 201 });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(target.endpoint);
		const init = calls[0].init;
		expect(init.method).toBe('POST');
		const headers = init.headers as Record<string, string>;
		expect(headers.TTL).toBe('86400');
		expect(headers.Urgency).toBe('normal');
		expect(headers['Content-Encoding']).toBe('aes128gcm');
		expect(headers['Content-Type']).toBe('application/octet-stream');
		expect(headers.Authorization).toMatch(/^vapid t=/);
		expect(init.body).toBeInstanceOf(Uint8Array);
	});

	it('returns 410 as a status, not an exception', async () => {
		const keys = await generateTestVapid();
		const fakeFetch = (async () => new Response(null, { status: 410 })) as typeof fetch;
		await expect(
			sendWebPush(target, 'hello', { ...keys, subject: 'mailto:a@b.c' }, { fetch: fakeFetch })
		).resolves.toEqual({ status: 410 });
	});

	it('passes ttl and urgency through', async () => {
		const keys = await generateTestVapid();
		const calls: RequestInit[] = [];
		const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
			calls.push(init!);
			return new Response(null, { status: 201 });
		}) as typeof fetch;

		await sendWebPush(
			target,
			'hello',
			{ ...keys, subject: 'mailto:a@b.c' },
			{
				fetch: fakeFetch,
				ttl: 60,
				urgency: 'high'
			}
		);

		const headers = calls[0].headers as Record<string, string>;
		expect(headers.TTL).toBe('60');
		expect(headers.Urgency).toBe('high');
	});
});
