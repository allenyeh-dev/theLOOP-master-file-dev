-- SOP submission + multi-step approval.
CREATE TABLE IF NOT EXISTS sop_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES sop_categories(id) ON DELETE SET NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  published_version_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- No rows in sop_brands = company-wide.
CREATE TABLE IF NOT EXISTS sop_brands (
  sop_id INTEGER NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (sop_id, brand_id)
);
CREATE INDEX IF NOT EXISTS idx_sop_brands_brand_id ON sop_brands(brand_id);

-- status: draft | in_review | rejected | published | superseded
CREATE TABLE IF NOT EXISTS sop_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sop_id INTEGER NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_by INTEGER REFERENCES users(id),
  submitted_at TEXT,
  published_at TEXT,
  ai_review_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (sop_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_sop_versions_sop_id ON sop_versions(sop_id);
CREATE INDEX IF NOT EXISTS idx_sop_versions_status ON sop_versions(status);

-- Approval chains. A NULL brand_id / category_id is a wildcard; the most specific match wins.
CREATE TABLE IF NOT EXISTS approval_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES sop_categories(id) ON DELETE CASCADE,
  UNIQUE (brand_id, category_id)
);

CREATE TABLE IF NOT EXISTS approval_chain_steps (
  chain_id INTEGER NOT NULL REFERENCES approval_chains(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (chain_id, step_no)
);

-- One row per step, created at submit time (snapshot of the chain). decision NULL = pending.
CREATE TABLE IF NOT EXISTS sop_approvals (
  version_id INTEGER NOT NULL REFERENCES sop_versions(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  approver_id INTEGER REFERENCES users(id),
  decision TEXT,
  comment TEXT,
  decided_at TEXT,
  PRIMARY KEY (version_id, step_no)
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status);

INSERT INTO permissions (key, description) VALUES
  ('sop.submit', 'Submit SOPs for approval'),
  ('sop.approve', 'Approve or reject SOPs at an assigned approval step'),
  ('sop.manage', 'Manage SOP categories and approval chains');

-- Everyone may submit; approvers are manager and above; admin/ownership manage.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'sop.submit';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'sop.approve'
WHERE r.key IN ('manager', 'gm', 'executive', 'admin', 'ownership');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'sop.manage'
WHERE r.key IN ('admin', 'ownership');

INSERT INTO sop_categories (label) VALUES ('廚房'), ('外場'), ('清潔'), ('食安');

-- Default chain (wildcard brand + category): manager -> gm -> admin.
INSERT INTO approval_chains (brand_id, category_id) VALUES (NULL, NULL);
INSERT INTO approval_chain_steps (chain_id, step_no, role_id)
SELECT c.id, 1, r.id FROM approval_chains c, roles r WHERE c.brand_id IS NULL AND c.category_id IS NULL AND r.key = 'manager';
INSERT INTO approval_chain_steps (chain_id, step_no, role_id)
SELECT c.id, 2, r.id FROM approval_chains c, roles r WHERE c.brand_id IS NULL AND c.category_id IS NULL AND r.key = 'gm';
INSERT INTO approval_chain_steps (chain_id, step_no, role_id)
SELECT c.id, 3, r.id FROM approval_chains c, roles r WHERE c.brand_id IS NULL AND c.category_id IS NULL AND r.key = 'admin';
