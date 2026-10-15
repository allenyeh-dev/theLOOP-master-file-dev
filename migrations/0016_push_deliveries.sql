-- Per-device outcome of each push. 'sent' = the push service (Apple/Google/...) accepted it,
-- which is the closest signal we have to "delivered"; it can't confirm the device displayed it.
CREATE TABLE IF NOT EXISTS happening_push_deliveries (
  push_id INTEGER NOT NULL REFERENCES happening_pushes(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (push_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_user ON happening_push_deliveries(push_id, user_id);
