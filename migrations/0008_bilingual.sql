-- Bilingual content. Existing columns stay the source (English) text; *_zh holds the Traditional Chinese
-- version and the UI falls back to the base column when *_zh is NULL.
ALTER TABLE announcements ADD COLUMN title_zh TEXT;
ALTER TABLE announcements ADD COLUMN body_zh TEXT;
ALTER TABLE announcement_tags ADD COLUMN label_zh TEXT;
ALTER TABLE brand_happenings ADD COLUMN tag_label_zh TEXT;
ALTER TABLE brand_happenings ADD COLUMN title_zh TEXT;
ALTER TABLE brand_happenings ADD COLUMN event_date_zh TEXT;
ALTER TABLE brand_happenings ADD COLUMN detail_zh TEXT;

UPDATE announcements SET
  title_zh = '六月營運檢討 — 啟動說明會',
  body_zh = '所有總經理與主廚須出席本月營運檢討會議。議程將於前 24 小時發送。地點：中央廚房會議室。'
WHERE title = 'June Operations Review — Kickoff Briefing';
UPDATE announcements SET
  title_zh = '新早午餐菜單上線 — 6 月 22 日',
  body_zh = '更新後的早午餐菜單將於 6 月 22 日上線。所有服務人員須在首次早午餐班次前完成菜單訓練 SOP。'
WHERE title = 'New Brunch Menu Launch — June 22';
UPDATE announcement_tags SET label_zh = '所有門店' WHERE label = 'ALL OUTLETS';
UPDATE announcement_tags SET label_zh = '必須' WHERE label = 'REQUIRED';

UPDATE brand_happenings SET
  tag_label_zh = '週五夜', event_date_zh = '6 月 20 日',
  detail_zh = '滿座 · 開瓶服務 · 凌晨 3 點打烊'
WHERE title = 'KOR x DJ Noodles';
UPDATE brand_happenings SET
  tag_label_zh = '私人活動', title_zh = 'Rancho 包場 — 60 人', event_date_zh = '6 月 21 日',
  detail_zh = '全場包場 · 流程表已確認 · 晚上 8 點至凌晨 1 點'
WHERE title = 'Rancho Buyout — 60 Pax';

-- SOP bilingual: content_json is the author's language (`lang`); the other language is an
-- AI-drafted, author-confirmed translation stored in title_alt / content_alt_json.
ALTER TABLE sop_versions ADD COLUMN lang TEXT NOT NULL DEFAULT 'zh';
ALTER TABLE sop_versions ADD COLUMN title_alt TEXT;
ALTER TABLE sop_versions ADD COLUMN content_alt_json TEXT;
