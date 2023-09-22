
-- 1. Add a new column
ALTER TABLE "salesforce_org" ADD COLUMN "orgLanguageLocaleKey_new" VARCHAR;

-- 2. Update the new column with values from the old column
UPDATE "salesforce_org" SET "orgLanguageLocaleKey_new" = "orgLanguageLocaleKey"::VARCHAR;

-- 3. Drop the old column
ALTER TABLE "salesforce_org" DROP COLUMN "orgLanguageLocaleKey";

-- 4. Rename the new column to the original column name
ALTER TABLE "salesforce_org" RENAME COLUMN "orgLanguageLocaleKey_new" TO "orgLanguageLocaleKey";

-- 5. DropEnum
DROP TYPE "salesforce_org_orglanguagelocalekey_enum";
