-- What's Happening feed: per-brand activity cards shown on the dashboard
-- below Announcements. Visible to every role except Executive (enforced client-side).
CREATE TABLE IF NOT EXISTS brand_happenings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'gold',
  icon TEXT NOT NULL DEFAULT 'calendar',
  tag_label TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_happenings_sort_order ON brand_happenings(sort_order);

INSERT INTO brand_happenings (brand, accent, icon, tag_label, title, event_date, detail, sort_order) VALUES
  ('KOR', 'red', 'music', 'FRIDAY NIGHT', 'KOR x DJ Noodles', 'June 20', 'Full house · Bottle service · 3am close', 0),
  ('Rancho', 'green', 'people', 'PRIVATE EVENT', 'Rancho Buyout — 60 Pax', 'June 21', 'Full venue · Run sheet confirmed · 8pm–1am', 1);
