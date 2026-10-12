-- AlterTable
ALTER TABLE "team_member" ADD COLUMN     "accessProfileId" UUID;

-- AlterTable
ALTER TABLE "team_member_invitation" ADD COLUMN     "accessProfileId" UUID;

-- CreateTable
CREATE TABLE "team_access_profile" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "teamId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "policy" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "team_access_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_access_profile_teamId_name_key" ON "team_access_profile"("teamId", "name");

-- CreateIndex
CREATE INDEX "team_member_accessProfileId_idx" ON "team_member"("accessProfileId");

-- CreateIndex
CREATE INDEX "team_member_invitation_accessProfileId_idx" ON "team_member_invitation"("accessProfileId");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "team_access_profile"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_invitation" ADD CONSTRAINT "team_member_invitation_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "team_access_profile"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_access_profile" ADD CONSTRAINT "team_access_profile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_access_profile" ADD CONSTRAINT "team_access_profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_access_profile" ADD CONSTRAINT "team_access_profile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
