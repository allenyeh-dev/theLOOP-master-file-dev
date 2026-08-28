-- Ownership role: the top-tier account role (superset of Admin's permissions).
INSERT INTO roles (key, label) VALUES ('ownership', 'Ownership');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.key = 'ownership';

-- Demo Ownership account: Han / han@theloop.dev / Owner123!
INSERT INTO users (name, email, password_hash, title, role_id, is_active)
VALUES (
  'Han',
  'han@theloop.dev',
  'pbkdf2$100000$590b06d0acc8064cf1429d5dcd70607c$c4ce5615c4586e887ac2c6088881eea0ebebafedae7d25dbeb3799710f211272',
  'Ownership',
  (SELECT id FROM roles WHERE key = 'ownership'),
  1
);

-- Announcements feed
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'gold',
  posted_by TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcement_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'gold',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_announcement_tags_announcement_id ON announcement_tags(announcement_id);

INSERT INTO announcements (id, title, body, accent, posted_by, posted_at) VALUES
  (1, 'June Operations Review — Kickoff Briefing',
      'All GMs and Head Chefs are required to attend this month''s ops review. Agenda will be distributed 24hrs prior. Venue: Central Kitchen boardroom.',
      'gold', 'Ownership', '2026-06-15'),
  (2, 'New Brunch Menu Launch — June 22',
      'The updated brunch menu goes live June 22. All service staff must complete the menu training SOP before their first brunch shift.',
      'orange', 'GM Santa Fe', '2026-06-14');

INSERT INTO announcement_tags (announcement_id, label, variant, sort_order) VALUES
  (1, 'ALL OUTLETS', 'gold', 0),
  (1, 'REQUIRED', 'red', 1),
  (2, 'SANTA FE', 'orange', 0);
