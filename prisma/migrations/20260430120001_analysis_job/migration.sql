-- CreateTable
CREATE TABLE "analysis_job" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "salesforceOrgUniqueId" VARCHAR NOT NULL,
    "jobType" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "errorMessage" VARCHAR(2000),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_job_userId_salesforceOrgUniqueId_createdAt_idx" ON "analysis_job"("userId", "salesforceOrgUniqueId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "analysis_job" ADD CONSTRAINT "analysis_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
