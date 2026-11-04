import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Only allow same-origin relative paths as post-login destinations.
const safeNext = (value: unknown) =>
	typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	google: async ({ locals, request }) => {
		const form = await request.formData();
		const result = await locals.auth.api.signInSocial({
			body: { provider: 'google', callbackURL: safeNext(form.get('next')) }
		});
		if (!result?.url) return fail(500, { failed: true });
		redirect(303, result.url, { external: ['https://accounts.google.com'] });
	}
};
