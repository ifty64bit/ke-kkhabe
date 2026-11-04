import { defineConfig } from 'drizzle-kit';

// Credentials are only needed for remote commands (push/studio/migrate against D1 over HTTP).
// `db:generate` works offline; apply migrations with `bun run db:migrate:local|remote` (wrangler).
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
		databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? '',
		token: process.env.CLOUDFLARE_D1_TOKEN ?? ''
	},
	verbose: true,
	strict: true
});
