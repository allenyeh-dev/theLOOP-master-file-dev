-- Daily Ops Board per brand: 86 list, daily specials, shift notes and reservations.
-- `data` is a JSON document validated by the API; one row per brand per date.
CREATE TABLE IF NOT EXISTS ops_boards (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  board_date TEXT NOT NULL, -- 'YYYY-MM-DD' (the restaurant's local day)
  data TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, board_date)
);
