-- CreateTable
CREATE TABLE "rate_limit" (
    "key" VARCHAR(255) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "resetTime" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limit_resetTime_idx" ON "rate_limit"("resetTime");
