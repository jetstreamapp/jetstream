-- CreateEnum
CREATE TYPE "public"."Feature" AS ENUM ('ALL', 'QUERY', 'UPDATE_RECORDS', 'AUTOMATION_CONTROL', 'PERMISSION_MANAGER', 'DEPLOYMENT', 'DEVELOPER_TOOLS');

-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "hasPasswordSet" boolean GENERATED ALWAYS AS (
  password IS NOT NULL
) STORED;

-- AlterTable
ALTER TABLE "public"."billing_account"
ADD COLUMN     "manualBilling" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."login_configuration"
ADD COLUMN     "autoAddToTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "public"."sessions"
ADD COLUMN "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
-- Convert to jsonb (indexable, compact).
ALTER COLUMN sess TYPE jsonb USING sess::jsonb,
-- Add generated column for the user id inside sess.user.id
ADD COLUMN user_id uuid GENERATED ALWAYS AS ((sess->'user'->>'id')::uuid) STORED;

-- Composite index for query pattern (filter users, order by newest)
CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at_sid
  ON "public"."sessions" (user_id, "createdAt" DESC, sid DESC);

-- CreateTable
CREATE TABLE "public"."team" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "loginConfigId" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "billingStatus" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_member" (
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "features" "public"."Feature"[] DEFAULT ARRAY['ALL']::"public"."Feature"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "public"."team_member_invitation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "teamId" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    "features" "public"."Feature"[] DEFAULT ARRAY['ALL']::"public"."Feature"[],
    "token" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "team_member_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_entitlement" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "teamId" UUID NOT NULL,
    "chromeExtension" BOOLEAN NOT NULL DEFAULT false,
    "googleDrive" BOOLEAN NOT NULL DEFAULT false,
    "recordSync" BOOLEAN NOT NULL DEFAULT false,
    "desktop" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_billing_account" (
    "teamId" UUID NOT NULL,
    "customerId" TEXT NOT NULL,
    "manualBilling" BOOLEAN NOT NULL DEFAULT false,
    "licenseCountLimit" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."team_subscription" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "teamId" UUID NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" UUID,
    "subscriptionId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_TeamSharedOrgs" (
    "A" INTEGER NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TeamSharedOrgs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_loginConfigId_key" ON "public"."team"("loginConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_userId_key" ON "public"."team_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_invitation_token_key" ON "public"."team_member_invitation"("token");

-- CreateIndex
CREATE INDEX "team_member_invitation_teamId_expiresAt_idx" ON "public"."team_member_invitation"("teamId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "unique_team_email" ON "public"."team_member_invitation"("teamId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "team_entitlement_teamId_key" ON "public"."team_entitlement"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_billing_account_teamId_key" ON "public"."team_billing_account"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_billing_account_customerId_key" ON "public"."team_billing_account"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_team_customer" ON "public"."team_billing_account"("teamId", "customerId");

-- CreateIndex
CREATE INDEX "team_subscription_teamId_status_idx" ON "public"."team_subscription"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "unique_team_subscription" ON "public"."team_subscription"("teamId", "subscriptionId", "priceId");

-- CreateIndex
CREATE INDEX "_TeamSharedOrgs_B_index" ON "public"."_TeamSharedOrgs"("B");

-- CreateIndex
CREATE INDEX "LoginActivity_userId_createdAt_id_idx" ON "public"."LoginActivity"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sessions_user_expire_sid" ON "public"."sessions"("user_id", "createdAt" DESC, "sid" DESC);

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_loginConfigId_fkey" FOREIGN KEY ("loginConfigId") REFERENCES "public"."login_configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member_invitation" ADD CONSTRAINT "team_member_invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member_invitation" ADD CONSTRAINT "team_member_invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member_invitation" ADD CONSTRAINT "team_member_invitation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_configuration" ADD CONSTRAINT "login_configuration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_configuration" ADD CONSTRAINT "login_configuration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_entitlement" ADD CONSTRAINT "team_entitlement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_billing_account" ADD CONSTRAINT "team_billing_account_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_subscription" ADD CONSTRAINT "team_subscription_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_subscription" ADD CONSTRAINT "team_subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."team_billing_account"("customerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TeamSharedOrgs" ADD CONSTRAINT "_TeamSharedOrgs_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."salesforce_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TeamSharedOrgs" ADD CONSTRAINT "_TeamSharedOrgs_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
