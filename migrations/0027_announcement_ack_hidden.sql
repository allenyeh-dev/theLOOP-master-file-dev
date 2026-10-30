-- A user can remove an acknowledged pop-up from their own log; the acknowledgement itself is kept
-- so the read / unread roster in the console stays accurate.
ALTER TABLE announcement_acks ADD COLUMN hidden_at TEXT;
