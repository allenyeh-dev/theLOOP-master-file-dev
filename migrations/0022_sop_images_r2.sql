-- Image bytes moved to R2 (bucket theloop-master-file, key sop-images/<id>). Run
-- scripts/migrate-sop-images-to-r2.mjs BEFORE applying this, or existing images are lost.
CREATE TABLE sop_images_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO sop_images_new (id, mime, size, created_by, created_at) SELECT id, mime, size, created_by, created_at FROM sop_images;
DROP TABLE sop_images;
ALTER TABLE sop_images_new RENAME TO sop_images;
