-- Item catalog. Safe for local AND production:
-- INSERT OR IGNORE only adds missing items and never overwrites a manager's edits.
-- Prices are not part of the catalog; they are entered per day when finalizing.
INSERT OR IGNORE INTO item (id, name_bn, name_en, unit_bn, unit_en, archived, created_at) VALUES
	('seed-paratha', 'পরোটা', 'Paratha', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-ruti', 'রুটি', 'Ruti', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-egg', 'ডিম ভাজি', 'Fried egg', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-egg-boiled', 'ডিম সেদ্ধ', 'Boiled egg', 'টি', 'pc', 0, unixepoch() * 1000),
	('seed-dal', 'ডাল', 'Dal', 'বাটি', 'bowl', 0, unixepoch() * 1000),
	('seed-bhaji', 'সবজি', 'Mixed vegetable', 'বাটি', 'bowl', 0, unixepoch() * 1000),
	('seed-halua', 'হালুয়া', 'Halua', 'বাটি', 'bowl', 0, unixepoch() * 1000),
	('seed-tea', 'চা', 'Tea', 'কাপ', 'cup', 0, unixepoch() * 1000);
