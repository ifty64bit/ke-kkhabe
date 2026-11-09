import type { Auth, AuthSession, AuthUser } from '#lib/server/auth.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Theme } from '#lib/theme/index.ts';
import type { Locale } from '#lib/i18n/index.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: AuthUser;
			session?: AuthSession;
			auth: Auth;
			db: Db;
			theme: Theme;
			locale: Locale;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// No `Platform`: adapter-cloudflare v8 never passes one. Use `env` and `waitUntil`
		// from 'cloudflare:workers' instead.
	}
}

export {};
