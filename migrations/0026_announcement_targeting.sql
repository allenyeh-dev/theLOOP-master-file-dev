-- Announcement audience + display mode.
-- target_type: 'all' (everyone) | 'brand' | 'role' | 'user'; target_id is the brand / role / user id (NULL for 'all').
-- display_mode: 'feed' = listed on the home page; 'modal' = blocking sheet the user must acknowledge.
ALTER TABLE announcements ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE announcements ADD COLUMN target_id INTEGER;
ALTER TABLE announcements ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'feed';

-- Carry over the single-brand scoping that 0006 recorded but nothing enforced.
UPDATE announcements
SET target_type = 'brand',
    target_id = (SELECT ab.brand_id FROM announcement_brands ab WHERE ab.announcement_id = announcements.id)
WHERE (SELECT COUNT(*) FROM announcement_brands ab WHERE ab.announcement_id = announcements.id) = 1;

-- Who has acknowledged a 'modal' announcement.
CREATE TABLE IF NOT EXISTS announcement_acks (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement_id, user_id)
);

-- Per-device outcome of the push sent with a 'modal' announcement (see 0016).
CREATE TABLE IF NOT EXISTS announcement_push_deliveries (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement_id, endpoint)
);
