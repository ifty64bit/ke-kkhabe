/**
 * Promote manager accounts in D1.
 *
 *   bun run db:seed:local                     # emails from ADMIN_EMAILS in .env
 *   bun run db:seed:remote
 *   bun run db:seed:local -- a@gmail.com b@gmail.com   # explicit emails
 *
 * Accounts are created by Google sign-in, so only people who have signed in once can be
 * promoted here. Emails without an account are reported; if they are in ADMIN_EMAILS they
 * become managers automatically on first sign-in.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const target = args.includes('--remote') ? '--remote' : args.includes('--local') ? '--local' : null;
if (!target) {
	console.error('Pass --local or --remote');
	process.exit(1);
}

const fromArgs = args.filter((a) => !a.startsWith('--'));
const raw = fromArgs.length ? fromArgs.join(',') : (process.env.ADMIN_EMAILS ?? '');
const emails = [
	...new Set(
		raw
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
	)
];

const EMAIL = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;
const invalid = emails.filter((e) => !EMAIL.test(e));
if (invalid.length) {
	console.error(`Not valid emails: ${invalid.join(', ')}`);
	process.exit(1);
}
if (!emails.length) {
	console.error('No emails. Set ADMIN_EMAILS in .env or pass emails as arguments.');
	process.exit(1);
}

const list = emails.map((e) => `'${e.replaceAll("'", "''")}'`).join(', ');

function d1(sql: string) {
	const res = spawnSync(
		'bunx',
		['wrangler', 'd1', 'execute', 'ke-khabe', target!, '--json', '--command', sql],
		{ encoding: 'utf8' }
	);
	if (res.status !== 0) {
		console.error(res.stderr || res.stdout);
		process.exit(res.status ?? 1);
	}
	return JSON.parse(res.stdout) as { results: Record<string, unknown>[] }[];
}

const where = `lower(email) IN (${list})`;
d1(`UPDATE user SET role = 'manager', updated_at = unixepoch() * 1000 WHERE ${where}`);
const rows = d1(`SELECT lower(email) AS email, role FROM user WHERE ${where}`)[0].results as {
	email: string;
	role: string;
}[];

const found = new Set(rows.map((r) => r.email));
console.log(`\nManagers (${target === '--remote' ? 'production' : 'local'} database):`);
for (const r of rows) console.log(`  ✔ ${r.email}  ${r.role}`);
for (const e of emails.filter((e) => !found.has(e)))
	console.log(`  · ${e}  no account yet (becomes manager on first sign-in if in ADMIN_EMAILS)`);
