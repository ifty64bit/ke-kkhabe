-- LOCAL ONLY. Creates an OPEN day for today (Asia/Dhaka) offering the seeded items,
-- so the Today page can be tried before the manager screens exist.
-- Never run against production: it would add a fake day to everyone's ledger.
INSERT OR IGNORE INTO day (id, date, status, created_by, created_at)
SELECT 'seed-day-' || date('now', '+6 hours'), date('now', '+6 hours'), 'open',
	(SELECT id FROM user ORDER BY created_at LIMIT 1), unixepoch() * 1000
WHERE EXISTS (SELECT 1 FROM user);

INSERT OR IGNORE INTO day_item (day_id, item_id, available)
SELECT 'seed-day-' || date('now', '+6 hours'), id, 1 FROM item
WHERE id IN ('seed-paratha', 'seed-egg', 'seed-dal', 'seed-bhaji', 'seed-tea')
	AND EXISTS (SELECT 1 FROM day WHERE id = 'seed-day-' || date('now', '+6 hours'));
