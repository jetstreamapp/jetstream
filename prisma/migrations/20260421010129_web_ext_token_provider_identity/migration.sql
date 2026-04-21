-- AlterTable
ALTER TABLE "web_extension_token" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerAccountId" TEXT;

-- CreateIndex
CREATE INDEX "web_extension_token_userId_provider_providerAccountId_idx" ON "web_extension_token"("userId", "provider", "providerAccountId");
