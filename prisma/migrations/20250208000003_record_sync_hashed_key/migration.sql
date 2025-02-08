CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- DropIndex
DROP INDEX "user_key_org";

-- AlterTable - add hashedKey column
ALTER TABLE "user_sync_data"
  ADD COLUMN "hashedKey" CHAR(40);

-- AlterTable - hash existing key
UPDATE "user_sync_data"
SET "hashedKey" = encode(digest(key, 'sha1'), 'hex');

-- AlterTable - Add hash key to data object
UPDATE "user_sync_data"
SET data = jsonb_set(data, '{hashedKey}', to_jsonb("hashedKey")::jsonb)
WHERE data->>'hashedKey' IS NULL;

-- Ensure hashedKey is not null
ALTER TABLE "user_sync_data"
  ALTER COLUMN "hashedKey" SET NOT NULL;

-- Re-CreateIndex
CREATE UNIQUE INDEX "user_hashed_key_org" ON "user_sync_data"("userId", "hashedKey", "orgId");
