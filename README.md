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
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: run `bun scripts/vapid-keys.ts` and paste the two lines
   - `VAPID_SUBJECT`: `mailto:<admin email>` (used by push services to contact you)
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

### Managers

```sh
bun run db:seed:local    # promote ADMIN_EMAILS (from .env) to manager in local D1
bun run db:seed:remote   # same, in production D1
bun run db:seed:local -- a@gmail.com b@gmail.com   # or pass emails explicitly
```

Accounts are created by Google sign-in, so a person must sign in once before they can be promoted. Emails listed in `ADMIN_EMAILS` are also promoted automatically on sign-in.

## Deploying

1. `wrangler d1 create ke-khabe` and put the returned `database_id` in `wrangler.jsonc`
2. `bun run db:migrate:remote`
3. Set secrets: `wrangler secret put BETTER_AUTH_SECRET` (and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `ORIGIN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; generate the VAPID pair with `bun scripts/vapid-keys.ts`)
4. `bun run build && wrangler deploy`

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the product spec.
