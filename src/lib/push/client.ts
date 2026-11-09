import { deserialize } from '$app/forms';

export type PushSupport = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted';

function isIos(): boolean {
	const nav = navigator as Navigator & { maxTouchPoints?: number };
	return (
		/iphone|ipad|ipod/i.test(nav.userAgent) ||
		(nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
	);
}

function isStandalone(): boolean {
	const nav = navigator as Navigator & { standalone?: boolean };
	return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export function pushSupport(): PushSupport {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
	if (
		!('serviceWorker' in navigator) ||
		!('PushManager' in window) ||
		!('Notification' in window)
	) {
		return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
	}
	return Notification.permission;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!('serviceWorker' in navigator)) return null;
	try {
		const registration = await navigator.serviceWorker.getRegistration('/');
		if (!registration) return null;
		return await registration.pushManager.getSubscription();
	} catch {
		return null;
	}
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function encodeBase64Url(buffer: ArrayBuffer | null): string {
	if (!buffer) return '';
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Register the worker, ask for permission, subscribe, then save the subscription on the server. */
export async function enablePush(publicKey: string): Promise<'on' | 'denied' | 'error'> {
	let subscription: PushSubscription | null = null;
	try {
		// Ask first, straight from the click: Safari needs the user gesture to still be live.
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return 'denied';
		await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		// subscribe() needs an active worker; on first registration it is still installing.
		const registration = await navigator.serviceWorker.ready;

		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: decodeBase64Url(publicKey)
		});
		const form = new FormData();
		form.set('endpoint', subscription.endpoint);
		form.set('p256dh', encodeBase64Url(subscription.getKey('p256dh')));
		form.set('auth', encodeBase64Url(subscription.getKey('auth')));
		const response = await fetch('/notifications?/subscribe', { method: 'POST', body: form });
		const result = deserialize(await response.text());
		if (result.type === 'success') return 'on';
	} catch {
		// Fall through to clean up the browser side.
	}
	await subscription?.unsubscribe();
	return 'error';
}

export async function disablePush(): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.getRegistration('/');
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return;
	const form = new FormData();
	form.set('endpoint', subscription.endpoint);
	await fetch('/notifications?/unsubscribe', { method: 'POST', body: form });
	await subscription.unsubscribe();
}
