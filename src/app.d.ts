import type { Auth, AuthSession, AuthUser } from '#lib/server/auth.ts';
import type { Db } from '#lib/server/db/index.ts';
import type { Theme } from '#lib/theme/index.ts';

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
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
		}
	}
}

export {};
