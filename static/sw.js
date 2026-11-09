// Push notifications only; no caching.
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
	let message = {};
	if (event.data) {
		try {
			message = event.data.json();
		} catch {
			message = { body: event.data.text() };
		}
	}
	event.waitUntil(
		self.registration.showNotification(message.title ?? 'কে খাবে', {
			body: message.body,
			tag: message.tag,
			renotify: Boolean(message.tag),
			icon: '/icons/icon-192.png',
			badge: '/icons/badge-96.png',
			data: { url: message.url ?? '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
			if (client) return client.focus().then((focused) => focused.navigate(url));
			return self.clients.openWindow(url);
		})
	);
});
