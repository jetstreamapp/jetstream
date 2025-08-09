-- AlterTable
ALTER TABLE "User"
ADD COLUMN "hasPasswordSet" boolean GENERATED ALWAYS AS (
  password IS NOT NULL
) STORED;
