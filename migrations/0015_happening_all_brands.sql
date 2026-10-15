-- all_brands = 1: the event is company-wide (every active user sees it and is notified),
-- regardless of brand_id.
ALTER TABLE brand_happenings ADD COLUMN all_brands INTEGER NOT NULL DEFAULT 0;
