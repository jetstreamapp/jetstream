/*
  Warnings:

  - A unique constraint covering the columns `[jetstreamUserId2,jetstreamUrl,uniqueId]` on the table `salesforce_org` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "uniqueOrg";

-- CreateIndex
CREATE UNIQUE INDEX "uniqueOrg" ON "salesforce_org"("jetstreamUserId2", "jetstreamUrl", "uniqueId");
