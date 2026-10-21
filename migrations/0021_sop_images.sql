-- Images attached to SOP steps. Stored in D1 (client resizes to ~1280px JPEG before upload);
-- steps reference them by id in content_json (steps[].images).
CREATE TABLE IF NOT EXISTS sop_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
