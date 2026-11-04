# Ke Khabe

Office breakfast order management. Every day, each person answers "Aj khaben?", the manager sets the price for the day's items, and each person's due amount builds up into a monthly report.

## Stack

- SvelteKit (Svelte 5) on Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- Better Auth (email/password)
- Tailwind CSS v4

## Setup

1. `bun install`
2. `cp .env.example .env` and fill in:
   - `ORIGIN`: `http://localhost:5173` for dev
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: create an OAuth client (Web application) in Google Cloud Console with the authorized redirect URI `<ORIGIN>/api/auth/callback/google`
   - `ADMIN_EMAILS`: comma-separated emails that become managers
3. `bun run db:migrate:local`
4. `bun run dev`

## Database

Drizzle ORM on Cloudflare D1. Schema lives in `src/lib/server/db/schema.ts`. Better Auth tables are generated into `auth.schema.ts`.

```sh
bun run auth:schema        # regenerate Better Auth tables (after changing auth config)
bun run db:generate        # generate SQL migration into ./drizzle
bun run db:migrate:local   # apply to local D1 (wrangler)
bun run db:migrate:remote  # apply to production D1
```

### Seed data

```sh
bun run db:seed:local    # item catalog + an open day for today (for trying the Today page)
bun run db:seed:remote   # item catalog only; safe to re-run, never overwrites edits
```

Seed files live in `scripts/seed/`. `dev-day.sql` is local-only: on production it would add a fake day to everyone's ledger.

## Deploying

1. `wrangler d1 create ke-khabe` and put the returned `database_id` in `wrangler.jsonc`
2. `bun run db:migrate:remote`
3. Set secrets: `wrangler secret put BETTER_AUTH_SECRET` (and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `ORIGIN`)
4. `bun run build && wrangler deploy`

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the product spec.
