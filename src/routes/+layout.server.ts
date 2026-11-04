import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const u = locals.user;
	return {
		theme: locals.theme,
		user: u
			? {
					id: u.id,
					name: u.name,
					email: u.email,
					image: u.image ?? null,
					role: u.role ?? 'member',
					locale: u.locale ?? 'bn'
				}
			: null
	};
};
