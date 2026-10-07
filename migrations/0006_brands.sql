-- Brand hierarchy: users belong to one or more brands and only see data scoped to them.
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_brands (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_user_brands_brand_id ON user_brands(brand_id);

INSERT INTO brands (key, label, sort_order) VALUES
  ('clv', 'CLV', 0),
  ('spc', 'SPC', 1),
  ('rancho', 'Rancho', 2),
  ('santafe', 'SantaFe', 3);

-- Backfill: every existing account keeps today's visibility (all brands).
-- Admins can narrow it per user from the console.
INSERT INTO user_brands (user_id, brand_id)
SELECT u.id, b.id FROM users u CROSS JOIN brands b;

-- Announcements: no rows in announcement_brands = company-wide (visible to all).
CREATE TABLE IF NOT EXISTS announcement_brands (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, brand_id)
);

INSERT INTO announcement_brands (announcement_id, brand_id)
SELECT 2, id FROM brands WHERE key = 'santafe';

-- Happenings: brand_id NULL = not attached to any brand (hidden from brand-scoped users).
ALTER TABLE brand_happenings ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;

UPDATE brand_happenings SET brand_id = (SELECT id FROM brands WHERE key = 'rancho') WHERE brand = 'Rancho';
