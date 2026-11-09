-- Personal permissions: granted to individual people instead of whole roles.
--   sop.manage    create, edit and submit SOPs (everyone can still read the SOPs of their own brands / departments)
--   recipe.manage create and edit recipes (own brands only)
-- A person's effective permissions are their role's permissions plus these (admins always have both).
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, permission_id)
);

UPDATE permissions SET description = 'Create, edit and submit SOPs (without it SOPs are view-only)' WHERE key = 'sop.manage';
UPDATE permissions SET description = 'Create and edit recipes of own brands' WHERE key = 'recipe.manage';

-- Keep today's behaviour: everyone who could submit SOPs (`sop.submit` via their role) and everyone whose role
-- had `recipe.manage` is granted the personal permission. An admin then trims the list per person.
INSERT OR IGNORE INTO user_permissions (user_id, permission_id)
SELECT u.id, (SELECT id FROM permissions WHERE key = 'sop.manage')
FROM users u JOIN role_permissions rp ON rp.role_id = u.role_id JOIN permissions p ON p.id = rp.permission_id AND p.key = 'sop.submit'
WHERE u.role_id IS NOT NULL;

INSERT OR IGNORE INTO user_permissions (user_id, permission_id)
SELECT u.id, (SELECT id FROM permissions WHERE key = 'recipe.manage')
FROM users u JOIN role_permissions rp ON rp.role_id = u.role_id JOIN permissions p ON p.id = rp.permission_id AND p.key = 'recipe.manage'
WHERE u.role_id IS NOT NULL;

-- These are no longer role permissions; `sop.submit` is replaced by `sop.manage`.
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key IN ('sop.manage', 'recipe.manage', 'sop.submit'));
DELETE FROM permissions WHERE key = 'sop.submit';
