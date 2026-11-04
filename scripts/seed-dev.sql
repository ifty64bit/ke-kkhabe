-- Local development seed: a small item catalog and an OPEN day for today (Asia/Dhaka).
-- Run with: bun run db:seed:local   (local D1 only; never run against production)
INSERT OR IGNORE INTO item (id, name_bn, name_en, unit_bn, unit_en, archived, created_at) VALUES
	('seed-paratha', 'পরোটা', 'Paratha', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-egg', 'ডিম ভাজি', 'Fried egg', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-dal', 'ডাল', 'Dal', 'বাটি', 'bowl', 0, unixepoch() * 1000),
	('seed-bhaji', 'সবজি', 'Mixed vegetable', 'বাটি', 'bowl', 0, unixepoch() * 1000),
	('seed-tea', 'চা', 'Tea', 'কাপ', 'cup', 0, unixepoch() * 1000);

INSERT OR IGNORE INTO day (id, date, status, created_by, created_at)
SELECT 'seed-day-' || date('now', '+6 hours'), date('now', '+6 hours'), 'open', (SELECT id FROM user ORDER BY created_at LIMIT 1), unixepoch() * 1000
WHERE EXISTS (SELECT 1 FROM user);

INSERT OR IGNORE INTO day_item (day_id, item_id, available)
SELECT 'seed-day-' || date('now', '+6 hours'), id, 1 FROM item WHERE id LIKE 'seed-%'
AND EXISTS (SELECT 1 FROM day WHERE id = 'seed-day-' || date('now', '+6 hours'));
