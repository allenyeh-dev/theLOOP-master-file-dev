-- A user's SOP department; their SOP page and home shortcut default to it. NULL = no department (sees all).
ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES sop_departments(id) ON DELETE SET NULL;
UPDATE users SET department_id = (SELECT id FROM sop_departments WHERE key = 'BOH')
WHERE role_id = (SELECT id FROM roles WHERE key = 'chef');
