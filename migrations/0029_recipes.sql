-- Recipes (food / drink specs), created and published from the admin console.
-- content_json is the author's language (`lang`); the other language is an AI-drafted, author-confirmed
-- translation in name_alt / content_alt_json (same idea as sop_versions).
-- brand_id NULL = all brands. code is typed by the admin (existing number) or assigned on first publish,
-- e.g. KOR-RCP-001 (code_prefix = KOR-RCP, code_seq = 1).
-- status: draft | published
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  code_prefix TEXT,
  code_seq INTEGER,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  lang TEXT NOT NULL DEFAULT 'zh',
  name TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  name_alt TEXT,
  content_alt_json TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipes_brand_id ON recipes(brand_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
