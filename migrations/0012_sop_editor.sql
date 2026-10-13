-- Anyone may edit a SOP, so the person who last edited a version is tracked per version
-- (sops.created_by stays the original author). The self-approval rule uses this editor.
ALTER TABLE sop_versions ADD COLUMN edited_by INTEGER REFERENCES users(id);
UPDATE sop_versions SET edited_by = (SELECT created_by FROM sops WHERE sops.id = sop_versions.sop_id) WHERE edited_by IS NULL;
