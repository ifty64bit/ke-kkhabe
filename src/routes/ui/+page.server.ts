import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

// Component gallery for development only.
export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
};
