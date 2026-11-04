/**
 * Wipe all order data from D1: every day and what hangs off it (day items, responses,
 * order lines, bill payments) plus the day audit entries. Users, accounts, sessions, the
 * item menu, settlements and non-day audit entries are kept.
 *
 *   bun run db:reset-orders:local
 *   bun run db:reset-orders:remote            # asks for confirmation, saves a Time Travel bookmark
 *   bun run db:reset-orders:remote -- --yes   # skip the confirmation
 *
 * Undo a remote reset with:  bunx wrangler d1 time-travel restore ke-khabe --bookmark=<bookmark>
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const DB = 'ke-khabe';
const args = process.argv.slice(2);
const target = args.includes('--remote') ? '--remote' : args.includes('--local') ? '--local' : null;
if (!target) {
	console.error('Pass --local or --remote');
	process.exit(1);
}
const remote = target === '--remote';
const label = remote ? 'production' : 'local';

/** Children first, so it works whether or not foreign-key cascades are enforced. */
const TABLES = ['order_line', 'response', 'bill_payment', 'day_item', 'day'] as const;

function wrangler(cmd: string[]) {
	const res = spawnSync('bunx', ['wrangler', ...cmd], { encoding: 'utf8' });
	if (res.status !== 0) {
		console.error(res.stderr || res.stdout);
		process.exit(res.status ?? 1);
	}
	return res.stdout;
}

function d1(sql: string) {
	const out = wrangler(['d1', 'execute', DB, target!, '--json', '--command', sql]);
	return JSON.parse(out) as { results: Record<string, unknown>[] }[];
}

function counts() {
	// One row of scalar subqueries: D1 caps compound SELECTs at 5 terms.
	const cols = [
		...TABLES.map((t) => `(SELECT count(*) FROM "${t}") AS "${t}"`),
		`(SELECT count(*) FROM audit_log WHERE entity = 'day') AS "audit_log (day)"`
	];
	const row = d1(`SELECT ${cols.join(', ')}`)[0].results[0] as Record<string, number>;
	return Object.entries(row).map(([t, n]) => ({ t, n }));
}

const before = counts();
console.log(`\nOrder data in the ${label} database:`);
for (const r of before) console.log(`  ${r.t.padEnd(16)} ${r.n}`);

if (before.every((r) => r.n === 0)) {
	console.log('\nNothing to reset.');
	process.exit(0);
}

if (remote && !args.includes('--yes')) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(`\nDelete all of this from ${label}? Type "reset" to confirm: `);
	rl.close();
	if (answer.trim() !== 'reset') {
		console.log('Cancelled.');
		process.exit(1);
	}
}

if (remote) {
	const info = wrangler(['d1', 'time-travel', 'info', DB, '--json']);
	let bookmark: string | undefined;
	try {
		bookmark = (JSON.parse(info) as { bookmark?: string }).bookmark;
	} catch {
		// fall through and print the raw output
	}
	console.log(`\nRestore point: ${bookmark ?? info.trim()}`);
	if (bookmark)
		console.log(`  undo with: bunx wrangler d1 time-travel restore ${DB} --bookmark=${bookmark}`);
}

d1(
	[...TABLES.map((t) => `DELETE FROM "${t}";`), `DELETE FROM audit_log WHERE entity = 'day';`].join(
		' '
	)
);

const after = counts();
const left = after.filter((r) => r.n !== 0);
if (left.length) {
	console.error('\nSome rows remain:');
	for (const r of left) console.error(`  ${r.t.padEnd(16)} ${r.n}`);
	process.exit(1);
}
console.log(`\n✔ Orders reset in the ${label} database.`);
