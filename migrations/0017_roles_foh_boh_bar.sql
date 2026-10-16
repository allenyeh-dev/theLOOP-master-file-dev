-- Retire the Ownership role (its accounts become Admin) and add the FOH / BOH / Bar roles.
UPDATE users SET role_id = (SELECT id FROM roles WHERE key = 'admin')
WHERE role_id = (SELECT id FROM roles WHERE key = 'ownership');

UPDATE approval_chain_steps SET role_id = (SELECT id FROM roles WHERE key = 'admin')
WHERE role_id = (SELECT id FROM roles WHERE key = 'ownership');

UPDATE sops SET owner_role_id = NULL
WHERE owner_role_id = (SELECT id FROM roles WHERE key = 'ownership');

DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE key = 'ownership');
DELETE FROM roles WHERE key = 'ownership';

INSERT INTO roles (key, label) VALUES
  ('foh', 'FOH'),
  ('boh', 'BOH'),
  ('bar', 'Bar');

-- FOH: dashboard only. BOH: kitchen + inventory. Bar: inventory.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'dashboard.view'
WHERE r.key IN ('foh', 'boh', 'bar');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'kitchen.manage' WHERE r.key = 'boh';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'inventory.manage' WHERE r.key IN ('boh', 'bar');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'sop.submit' WHERE r.key IN ('foh', 'boh', 'bar');
