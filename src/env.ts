import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';

/** Required when the app starts, but not during `vite build` (CI has no secrets). */
const required = (name: string) => (value: string | undefined) => {
	if (!value && !building) throw new Error(`${name} is required`);
	return value ?? '';
};

const optional = (value: string | undefined) => value ?? '';

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.',
		schema: required('ORIGIN')
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).',
		schema: required('BETTER_AUTH_SECRET')
	},
	GOOGLE_CLIENT_ID: {
		description: 'Google OAuth client ID.',
		schema: required('GOOGLE_CLIENT_ID')
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Google OAuth client secret.',
		schema: required('GOOGLE_CLIENT_SECRET')
	},
	ADMIN_EMAILS: {
		description:
			'Comma-separated emails that become managers when they sign in, e.g. `a@gmail.com,b@gmail.com`.',
		schema: optional
	}
});
