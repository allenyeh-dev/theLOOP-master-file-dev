-- HQ (theLOOP) announcements: company-wide, shown only inside a publish window.
ALTER TABLE announcements ADD COLUMN starts_at TEXT; -- UTC 'YYYY-MM-DD HH:MM:SS'; NULL = live immediately
ALTER TABLE announcements ADD COLUMN ends_at TEXT;   -- NULL = never expires

-- Brand cards on the home page (logo, tile colour) + the extra brands.
ALTER TABLE brands ADD COLUMN logo_url TEXT;
ALTER TABLE brands ADD COLUMN bg_color TEXT;
ALTER TABLE brands ADD COLUMN sub_label TEXT;

INSERT OR IGNORE INTO brands (key, label, code, sort_order) VALUES
  ('kor', 'KOR', 'KOR', 1),
  ('oncor_xinyi', 'Oncor Xinyi', 'ONX', 4),
  ('oncor_taichung', 'Oncor Taichung', 'ONT', 5),
  ('central_kitchen', 'Central Kitchen', 'CK', 6),
  ('theloop', 'theLOOP', 'LOOP', 8);

UPDATE brands SET sort_order = 0, logo_url = '/brands/clv.png',  bg_color = '#ffffff' WHERE key = 'clv';
UPDATE brands SET sort_order = 1, logo_url = '/brands/kor.png',  bg_color = '#000000' WHERE key = 'kor';
UPDATE brands SET sort_order = 2, logo_url = '/brands/rancho.png', bg_color = '#14110c' WHERE key = 'rancho';
UPDATE brands SET sort_order = 3, logo_url = '/brands/santafe.png', bg_color = '#14110c' WHERE key = 'santafe';
UPDATE brands SET sort_order = 4, logo_url = '/brands/oncor.png', bg_color = '#1c1812', sub_label = 'Xinyi' WHERE key = 'oncor_xinyi';
UPDATE brands SET sort_order = 5, logo_url = '/brands/oncor.png', bg_color = '#1c1812', sub_label = 'Taichung' WHERE key = 'oncor_taichung';
UPDATE brands SET sort_order = 6, logo_url = '/brands/central_kitchen.png', bg_color = '#1f6b5a' WHERE key = 'central_kitchen';
UPDATE brands SET sort_order = 7, logo_url = '/brands/spc.png', bg_color = '#b8432a' WHERE key = 'spc';
UPDATE brands SET sort_order = 8, logo_url = '/brands/theloop.png', bg_color = '#bdbdb6' WHERE key = 'theloop';

-- Brand notices: shown on a brand's page whenever someone opens it. Re-readable (no acknowledge step).
CREATE TABLE IF NOT EXISTS brand_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  title_zh TEXT,
  body_zh TEXT,
  accent TEXT NOT NULL DEFAULT 'gold',
  tags TEXT NOT NULL DEFAULT '[]', -- JSON [{label,label_zh,variant}]
  posted_by TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_brand_notices_brand_id ON brand_notices(brand_id);
