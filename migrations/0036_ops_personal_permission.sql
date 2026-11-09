-- ops.manage: edit the daily Ops Board (86 list, packages, shift notes, bookings) of own brands.
-- A personal permission, granted per person on the Users page (like sop.manage / recipe.manage / schedule.manage).
INSERT OR IGNORE INTO permissions (key, description) VALUES ('ops.manage', 'Edit the daily Ops Board of own brands');

-- Keep today's behaviour: GM, Manager and Ownership could edit the board, so they are granted it personally.
INSERT OR IGNORE INTO user_permissions (user_id, permission_id)
SELECT u.id, (SELECT id FROM permissions WHERE key = 'ops.manage')
FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.key IN ('ownership', 'gm', 'manager');
