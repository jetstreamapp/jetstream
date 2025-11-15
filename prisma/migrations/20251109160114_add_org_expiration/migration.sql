/*
  Warnings:

  - Made the column `hasPasswordSet` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "hasPasswordSet" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."salesforce_org"
ADD COLUMN "expirationScheduledFor" TIMESTAMP(6),
ADD COLUMN "lastActivityAt" TIMESTAMP(6),
ADD COLUMN "lastExpirationNotificationAt" TIMESTAMP(6),
ADD COLUMN "nextExpirationNotificationDate" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "public"."sessions"
ALTER COLUMN "user_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID,
    "action" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(255) NOT NULL,
    "resourceId" VARCHAR(255),
    "metadata" JSON,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "audit_log_userId_createdAt_idx" ON "public"."audit_log"("userId", "createdAt");
CREATE INDEX "audit_log_action_createdAt_idx" ON "public"."audit_log"("action", "createdAt");
CREATE INDEX "audit_log_resource_resourceId_createdAt_idx" ON "public"."audit_log"("resource", "resourceId", "createdAt");
CREATE INDEX "salesforce_org_expirationScheduledFor_idx" ON "public"."salesforce_org"("expirationScheduledFor");
CREATE INDEX "salesforce_org_nextExpirationNotificationDate_idx" ON "public"."salesforce_org"("nextExpirationNotificationDate");
