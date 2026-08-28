-- RBAC schema: roles, permissions, role_permissions, sessions
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Extend users with auth + profile fields
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN title TEXT;
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Seed roles (matches THE LOOP role tabs: Admin / Executive / GM / Manager / Chef)
INSERT INTO roles (key, label) VALUES
  ('admin', 'Admin'),
  ('executive', 'Executive'),
  ('gm', 'GM'),
  ('manager', 'Manager'),
  ('chef', 'Chef');

-- Seed fine-grained permissions
INSERT INTO permissions (key, description) VALUES
  ('dashboard.view', 'View the main dashboard'),
  ('users.manage', 'Create, edit, and deactivate user accounts'),
  ('reports.view', 'View executive / financial reports'),
  ('schedule.manage', 'Create and edit staff schedules'),
  ('inventory.manage', 'Manage kitchen inventory and stock levels'),
  ('kitchen.manage', 'Manage kitchen operations and menu items');

-- admin: every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.key = 'admin';

-- executive: high-level visibility only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key IN ('dashboard.view', 'reports.view')
WHERE r.key = 'executive';

-- gm: oversight + people management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key IN ('dashboard.view', 'reports.view', 'schedule.manage', 'users.manage')
WHERE r.key = 'gm';

-- manager: day-to-day operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key IN ('dashboard.view', 'schedule.manage', 'inventory.manage')
WHERE r.key = 'manager';

-- chef: kitchen operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key IN ('dashboard.view', 'kitchen.manage', 'inventory.manage')
WHERE r.key = 'chef';
