-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoggedIn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "salesforce_org" ADD COLUMN     "jetstreamUserId2" UUID;

UPDATE salesforce_org
SET "jetstreamUserId2" = u.id
FROM "User" u
WHERE salesforce_org."jetstreamUserId" = u."userId";

-- AddForeignKey
ALTER TABLE "salesforce_org" ADD CONSTRAINT "salesforce_org_jetstreamUserId2_fkey" FOREIGN KEY ("jetstreamUserId2") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
