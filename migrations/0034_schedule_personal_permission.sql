-- schedule.manage becomes a personal permission (granted per person on the Users page), like sop.manage / recipe.manage.
UPDATE permissions SET description = 'Create, edit and publish staff schedules of own brands' WHERE key = 'schedule.manage';

-- Keep today's behaviour: everyone whose role had schedule.manage (GM, Manager) is granted it personally.
INSERT OR IGNORE INTO user_permissions (user_id, permission_id)
SELECT u.id, (SELECT id FROM permissions WHERE key = 'schedule.manage')
FROM users u JOIN role_permissions rp ON rp.role_id = u.role_id JOIN permissions p ON p.id = rp.permission_id AND p.key = 'schedule.manage'
WHERE u.role_id IS NOT NULL;

DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key = 'schedule.manage');
