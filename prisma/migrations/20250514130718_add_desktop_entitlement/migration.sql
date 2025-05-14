-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN "desktop" BOOLEAN NOT NULL DEFAULT false;

-- Update existing records
UPDATE "entitlement"
SET "desktop" = true
WHERE "chromeExtension" = true;
