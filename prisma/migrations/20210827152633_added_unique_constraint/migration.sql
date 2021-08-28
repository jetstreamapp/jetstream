/*
  Warnings:

  - A unique constraint covering the columns `[jetstreamUserId,jetstreamUrl,uniqueId]` on the table `salesforce_org` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "uniqueOrg" ON "salesforce_org"("jetstreamUserId", "jetstreamUrl", "uniqueId");
