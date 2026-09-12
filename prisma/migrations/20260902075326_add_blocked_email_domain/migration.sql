-- CreateEnum
CREATE TYPE "BlockedEmailDomainSource" AS ENUM ('MANUAL', 'LIST_SYNC');

-- CreateTable
CREATE TABLE "blocked_email_domain" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "domain" VARCHAR(255) NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT true,
    "source" "BlockedEmailDomainSource" NOT NULL DEFAULT 'MANUAL',
    "comments" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocked_email_domain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_email_domain_domain_key" ON "blocked_email_domain"("domain");

-- Prisma cannot express a CHECK constraint, so this is written by hand. Lookups lowercase the
-- address before querying and the unique index above is case sensitive, so a row stored with any
-- uppercase could never match. Without this a hand-added `Mailinator.com` would
-- be silently inert, and the next sync would insert a second lowercase LIST_SYNC row alongside it
-- rather than conflicting - quietly overriding an operator's allowlist decision. Rejecting the
-- write outright is the only way that failure becomes visible.
ALTER TABLE "blocked_email_domain"
  ADD CONSTRAINT "blocked_email_domain_domain_lowercase" CHECK ("domain" = lower("domain"));

-- Legitimate forwarding/aliasing services that public disposable-domain lists tend to include.
-- Seeded as MANUAL allowlist rows: the sync only ever deletes LIST_SYNC rows and never rewrites a
-- domain that already has one, so these survive every run without the job needing to know about
-- them. An operator who wants one blocked can flip `blocked` without a deploy.
INSERT INTO "blocked_email_domain" ("domain", "blocked", "source", "comments", "updatedAt") VALUES
  ('privaterelay.appleid.com', false, 'MANUAL', 'Apple Hide My Email', CURRENT_TIMESTAMP),
  ('icloud.com', false, 'MANUAL', 'Apple iCloud Mail', CURRENT_TIMESTAMP),
  ('mozmail.com', false, 'MANUAL', 'Firefox Relay', CURRENT_TIMESTAMP),
  ('relay.firefox.com', false, 'MANUAL', 'Firefox Relay', CURRENT_TIMESTAMP),
  ('duck.com', false, 'MANUAL', 'DuckDuckGo Email Protection', CURRENT_TIMESTAMP),
  ('simplelogin.com', false, 'MANUAL', 'SimpleLogin', CURRENT_TIMESTAMP),
  ('simplelogin.io', false, 'MANUAL', 'SimpleLogin', CURRENT_TIMESTAMP),
  ('anonaddy.com', false, 'MANUAL', 'addy.io (formerly AnonAddy)', CURRENT_TIMESTAMP),
  ('anonaddy.me', false, 'MANUAL', 'addy.io (formerly AnonAddy)', CURRENT_TIMESTAMP),
  ('addy.io', false, 'MANUAL', 'addy.io', CURRENT_TIMESTAMP);
