CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "web_extension_token" ADD COLUMN "tokenHash" VARCHAR(64);

-- Populate tokenHash for existing records
-- Encryption will happen on-the-fly as they are accessed and we may do a manual encryption migration later if needed
UPDATE "web_extension_token"
SET "tokenHash" = encode(digest("token", 'sha256'), 'hex')
WHERE token IS NOT NULL;

-- Make tokenHash NOT NULL
ALTER TABLE "web_extension_token" ALTER COLUMN "tokenHash" SET NOT NULL;

-- DropIndex (drop old unique constraint on token)
DROP INDEX IF EXISTS "web_extension_token_type_token_deviceId_key";

-- CreateIndex (add new unique constraint on tokenHash)
CREATE UNIQUE INDEX "web_extension_token_type_tokenHash_deviceId_key" ON "web_extension_token"("type", "tokenHash", "deviceId");
