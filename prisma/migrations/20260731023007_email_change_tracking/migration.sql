-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_change_request" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "currentEmail" VARCHAR(254) NOT NULL,
    "newEmail" VARCHAR(254) NOT NULL,
    "confirmTokenHash" CHAR(64) NOT NULL,
    "cancelTokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedIpAddress" VARCHAR(45),
    "requestedUserAgent" VARCHAR(500),
    "stepUpMethod" VARCHAR(20),
    "resolvedAt" TIMESTAMP(3),
    "resolvedIpAddress" VARCHAR(45),
    "resolvedUserAgent" VARCHAR(500),
    "resolvedVia" VARCHAR(30),
    "failureReason" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_change_request_userId_createdAt_idx" ON "email_change_request"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "email_change_request_newEmail_idx" ON "email_change_request"("newEmail");

-- CreateIndex
CREATE INDEX "email_change_request_status_expiresAt_idx" ON "email_change_request"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_request_confirmTokenHash_key" ON "email_change_request"("confirmTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_request_cancelTokenHash_key" ON "email_change_request"("cancelTokenHash");

-- AddForeignKey
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot express a partial unique index, so this is written by hand. At most one in-flight
-- request per user. The advisory-locked transaction in email-change.db.service.ts is the primary
-- guard; this is the database-level backstop.
-- NOTE: `prisma migrate dev` reports hand-written DDL like this as drift on later runs (same as the
-- generated columns on User.hasPasswordSet and sessions.user_id) — re-append if regenerated.
CREATE UNIQUE INDEX "email_change_request_one_pending_per_user"
  ON "email_change_request" ("userId")
  WHERE status = 'PENDING';

-- User.email is filtered by findUsersByEmail, generatePasswordResetToken, getUserAndVerifyPassword
-- and resolveSsoUser with no index today, and the email-change availability checks add two more hot
-- lookups. NON-UNIQUE on purpose: production contains duplicate emails, and the sign-in paths have
-- explicit multi-match handling for them, so uniqueness is enforced in the application instead.
CREATE INDEX "User_email_idx" ON "User" ("email");
