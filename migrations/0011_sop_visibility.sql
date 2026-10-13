-- SOP visibility by department. Users can belong to several departments; roles holding `sop.view_all`
-- see every SOP. Everyone else sees SOPs of their departments plus "general" ones
-- (no department, or a department flagged is_general).
CREATE TABLE IF NOT EXISTS user_departments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES sop_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);

-- Carry over the single department set earlier (users.department_id is no longer used).
INSERT OR IGNORE INTO user_departments (user_id, department_id)
SELECT id, department_id FROM users WHERE department_id IS NOT NULL;

ALTER TABLE sop_departments ADD COLUMN is_general INTEGER NOT NULL DEFAULT 0;
UPDATE sop_departments SET is_general = 1 WHERE key = 'General';

INSERT INTO permissions (key, description) VALUES ('sop.view_all', 'See SOPs of every department (not limited to own departments)');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'sop.view_all'
WHERE r.key IN ('admin', 'ownership', 'executive', 'gm', 'manager');
