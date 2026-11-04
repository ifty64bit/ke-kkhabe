import type { Handle } from '@sveltejs/kit/hooks';
import { redirect, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { building } from '$app/env';
import { createAuth } from '#lib/server/auth.ts';
import { isAdminEmail } from '#lib/server/admins.ts';
import { getDb } from '#lib/server/db/index.ts';
import { user as userTable } from '#lib/server/db/schema.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { parseTheme, THEME_COOKIE } from '#lib/theme/index.ts';
import { env } from 'cloudflare:workers';

const PUBLIC_PATHS = ['/login', '/api/auth'];
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
		if (path.startsWith('/manage') && u.role !== 'manager') {
			error(403, 'Managers only');
		}
	}

	const { theme } = event.locals;
	return svelteKitHandler({
		event,
		resolve: (e) =>
			resolve(e, { transformPageChunk: ({ html }) => html.replace('%ke.theme%', theme) }),
		auth,
		building
	});
};
