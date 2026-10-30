-- Add the Host SOP department. Security already exists, so INSERT OR IGNORE only adds what is missing.
INSERT OR IGNORE INTO sop_departments (key, label, sort_order) VALUES
  ('Host', 'Host', 6),
  ('Security', 'Security', 4);
