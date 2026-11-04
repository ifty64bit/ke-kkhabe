import type { Handle } from '@sveltejs/kit/hooks';
import { redirect, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { building, dev } from '$app/env';
import { createAuth } from '#lib/server/auth.ts';
import { isAdminEmail } from '#lib/server/admins.ts';
import { getDb } from '#lib/server/db/index.ts';
import { user as userTable } from '#lib/server/db/schema.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { parseTheme, THEME_COOKIE } from '#lib/theme/index.ts';
import { isLocale, LOCALE_COOKIE } from '#lib/i18n/index.ts';
import { env } from 'cloudflare:workers';

// `/ui` is the dev-only component gallery (404 in production via its load function).
const PUBLIC_PATHS = ['/login', '/api/auth', '/locale', ...(dev ? ['/ui'] : [])];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

export const handle: Handle = async ({ event, resolve }) => {
	const d1 = env.DB;
	if (!d1) throw new Error('D1 binding "DB" not found - check wrangler.jsonc');

	event.locals.theme = parseTheme(event.cookies.get(THEME_COOKIE));
	event.locals.db = getDb(d1);
	event.locals.auth = createAuth(d1);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		const u = session.user;
		// Emails added to ADMIN_EMAILS after first sign-in get promoted on their next request.
		if (u.role !== 'manager' && isAdminEmail(u.email)) {
			await event.locals.db
				.update(userTable)
				.set({ role: 'manager' })
				.where(eq(userTable.id, u.id));
			u.role = 'manager';
		}
		event.locals.session = session.session;
		event.locals.user = u;
	}

	// Language: the device's explicit choice (cookie), else the account's saved language, else Bangla.
	const cookieLocale = event.cookies.get(LOCALE_COOKIE);
	event.locals.locale = isLocale(cookieLocale)
		? cookieLocale
		: isLocale(event.locals.user?.locale)
			? event.locals.user.locale
			: 'en';

	const path = event.url.pathname;

	if (!isPublic(path)) {
		const u = event.locals.user;
		if (!u) {
			const next = path === '/' ? '' : `?next=${encodeURIComponent(path + event.url.search)}`;
			redirect(303, `/login${next}`);
		}
		if (u.active === false && path !== '/inactive' && path !== '/logout') {
			redirect(303, '/inactive');
		}
		// Page views are guarded in manage/+layout.server.ts (renders the themed error page).
		// Actions run before layout loads, so block non-GET requests here as well.
		if (path.startsWith('/manage') && event.request.method !== 'GET' && u.role !== 'manager') {
			error(403, 'Managers only');
		}
	}

	const { theme, locale } = event.locals;
	return svelteKitHandler({
		event,
		resolve: (e) =>
			resolve(e, {
				transformPageChunk: ({ html }) =>
					html.replace('%ke.theme%', theme).replace('%ke.lang%', locale)
			}),
		auth,
		building
	});
};
