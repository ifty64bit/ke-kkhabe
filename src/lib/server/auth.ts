import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '#lib/server/db/index.ts';
import { isAdminEmail } from '#lib/server/admins.ts';

const authConfig = {
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			prompt: 'select_account'
		}
	},
	user: {
		additionalFields: {
			role: {
				type: ['member', 'manager'],
				required: false,
				defaultValue: 'member',
				input: false
			},
			active: {
				type: 'boolean',
				required: false,
				defaultValue: true,
				input: false
			},
			locale: {
				type: ['bn', 'en'],
				required: false,
				defaultValue: 'bn',
				input: false
			}
		}
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user) => ({
					data: { ...user, role: isAdminEmail(user.email) ? 'manager' : 'member' }
				})
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth['$Infer']['Session']['user'];
export type AuthSession = Auth['$Infer']['Session']['session'];

/**
 * DO NOT USE!
 *
 * This instance is used by the `auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
