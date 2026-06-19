-- DropIndex
DROP INDEX "web_extension_token_deviceId_key";

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "key" VARCHAR(512) NOT NULL,
    "hits" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limit_hits_expires_at_idx" ON "rate_limit_hits"("expires_at");
