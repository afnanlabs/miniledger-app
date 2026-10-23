-- ===========================================================================
-- MiniLedger - optional loan receipt metadata
--
-- Safe to run on existing databases: every column is added with
-- `IF NOT EXISTS`, and existing loans keep NULL receipt fields. The binary
-- image itself lives on disk under UPLOAD_DIR; only a generated relative key
-- and descriptive metadata are stored in PostgreSQL.
-- ===========================================================================

ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_storage_key TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_mime_type VARCHAR(100);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_original_name TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_size_bytes INTEGER;

-- A receipt key must be unique so two loans can never claim the same file.
CREATE UNIQUE INDEX IF NOT EXISTS loans_receipt_storage_key_idx
  ON loans (receipt_storage_key)
  WHERE receipt_storage_key IS NOT NULL;
