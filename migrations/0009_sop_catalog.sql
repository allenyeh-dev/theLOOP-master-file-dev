-- SOP catalog: departments, SOP codes, owner role, read receipts, flags. Brand code for SOP numbering.
ALTER TABLE brands ADD COLUMN code TEXT;
UPDATE brands SET code = 'CLV' WHERE key = 'clv';
UPDATE brands SET code = 'SPC' WHERE key = 'spc';
UPDATE brands SET code = 'RAN' WHERE key = 'rancho';
UPDATE brands SET code = 'SF' WHERE key = 'santafe';

CREATE TABLE IF NOT EXISTS sop_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sop_departments (key, label, sort_order) VALUES
  ('FOH', 'FOH', 0), ('BOH', 'BOH', 1), ('Bar', 'Bar', 2), ('General', 'General', 3), ('Security', 'Security', 4);

ALTER TABLE sops ADD COLUMN department_id INTEGER REFERENCES sop_departments(id) ON DELETE SET NULL;
ALTER TABLE sops ADD COLUMN owner_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
-- Assigned on first publish, e.g. SF-BOH-002 (code_prefix = SF-BOH, code_seq = 2).
ALTER TABLE sops ADD COLUMN code_prefix TEXT;
ALTER TABLE sops ADD COLUMN code_seq INTEGER;
ALTER TABLE sops ADD COLUMN code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sops_code ON sops(code);

-- One read receipt per user per published version; a new version resets "read".
CREATE TABLE IF NOT EXISTS sop_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES sop_versions(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, version_id)
);

-- status: open | resolved
CREATE TABLE IF NOT EXISTS sop_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sop_id INTEGER NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES sop_versions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sop_flags_status ON sop_flags(status);
