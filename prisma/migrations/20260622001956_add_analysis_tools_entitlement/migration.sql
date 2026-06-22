-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN     "analysisTools" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_entitlement" ADD COLUMN     "analysisTools" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing paid users (identified by the chromeExtension entitlement) also get Analysis Tools.
UPDATE "entitlement" SET "analysisTools" = true WHERE "chromeExtension" = true;
UPDATE "team_entitlement" SET "analysisTools" = true WHERE "chromeExtension" = true;
