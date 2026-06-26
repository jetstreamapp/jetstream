-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN     "salesforceCanvas" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_entitlement" ADD COLUMN     "salesforceCanvas" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing paid users (identified by the chromeExtension entitlement) also get Analysis Tools.
UPDATE "entitlement" SET "salesforceCanvas" = true WHERE "chromeExtension" = true;
UPDATE "team_entitlement" SET "salesforceCanvas" = true WHERE "chromeExtension" = true;
