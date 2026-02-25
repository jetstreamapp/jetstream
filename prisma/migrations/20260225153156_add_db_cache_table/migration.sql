-- AlterTable
ALTER TABLE "domain_verification" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- CreateTable
CREATE TABLE "cache_entry" (
    "key" VARCHAR(512) NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_entry_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "cache_entry_expiresAt_idx" ON "cache_entry"("expiresAt");
