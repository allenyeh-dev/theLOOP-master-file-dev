-- Who may create and edit recipes from the main app (RECIPES tab). Admins always can; other roles are
-- granted this from the console's Permissions page. Holders can only touch recipes of their own brands.
INSERT OR IGNORE INTO permissions (key, description) VALUES ('recipe.manage', 'Create and edit recipes');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key = 'recipe.manage'
WHERE r.key IN ('admin', 'chef', 'boh');
