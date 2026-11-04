import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { isLocale, LOCALE_COOKIE } from '#lib/i18n/index.ts';
import { user } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/** Save the UI language: always on this device (cookie), and on the account when signed in. */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
	const locale = body?.locale;
	if (!isLocale(locale)) error(400, 'Unknown locale');

	cookies.set(LOCALE_COOKIE, locale, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});
	if (locals.user) {
		await locals.db.update(user).set({ locale }).where(eq(user.id, locals.user.id));
	}
	return new Response(null, { status: 204 });
};
