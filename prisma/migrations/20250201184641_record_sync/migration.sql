/*
  Warnings:

  - A unique constraint covering the columns `[jetstreamUserId2,uniqueId]` on the table `salesforce_org` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "uniqueOrg";

-- CreateTable
CREATE TABLE "user_sync_data" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "orgId" TEXT,
    "key" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "user_sync_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sync_data_userId_entity_updatedAt_idx" ON "user_sync_data"("userId", "entity", "updatedAt");

-- CreateIndex
CREATE INDEX "user_sync_data_deletedAt_idx" ON "user_sync_data"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_key_org" ON "user_sync_data"("userId", "key", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_org" ON "salesforce_org"("jetstreamUserId2", "uniqueId");

-- AddForeignKey
ALTER TABLE "user_sync_data" ADD CONSTRAINT "user_sync_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
