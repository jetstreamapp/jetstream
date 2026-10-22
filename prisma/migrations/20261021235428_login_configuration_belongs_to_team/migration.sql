-- Move the one-to-one relationship to the owned side: login_configuration.teamId replaces team.loginConfigId,
-- so a team is created first and deleting a team deletes its login configuration (and SSO configuration) with it

-- AlterTable
ALTER TABLE "login_configuration" ADD COLUMN     "teamId" UUID;

UPDATE "login_configuration"
SET "teamId" = "team"."id"
FROM "team"
WHERE "team"."loginConfigId" = "login_configuration"."id";

-- Configurations no team points at have no effect, sign in only reads the configuration of a team.
-- Their SSO configurations are removed by the existing ON DELETE CASCADE.
DELETE FROM "login_configuration" WHERE "teamId" IS NULL;

ALTER TABLE "login_configuration" ALTER COLUMN "teamId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "team" DROP CONSTRAINT "team_loginConfigId_fkey";

-- DropIndex
DROP INDEX "team_loginConfigId_key";

-- AlterTable
ALTER TABLE "team" DROP COLUMN "loginConfigId";

-- CreateIndex
CREATE UNIQUE INDEX "login_configuration_teamId_key" ON "login_configuration"("teamId");

-- AddForeignKey
ALTER TABLE "login_configuration" ADD CONSTRAINT "login_configuration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
