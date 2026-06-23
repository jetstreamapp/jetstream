-- CreateTable
CREATE TABLE "feature_flag_override" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" UUID,
    "teamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "feature_flag_override_userId_idx" ON "feature_flag_override"("userId");
CREATE INDEX "feature_flag_override_teamId_idx" ON "feature_flag_override"("teamId");
CREATE UNIQUE INDEX "unique_feature_flag_user" ON "feature_flag_override"("key", "userId");
CREATE UNIQUE INDEX "unique_feature_flag_team" ON "feature_flag_override"("key", "teamId");
ALTER TABLE "feature_flag_override" ADD CONSTRAINT "feature_flag_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_flag_override" ADD CONSTRAINT "feature_flag_override_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce exactly one scope per override (user XOR team); both-null rows are never resolved and both-set rows are ambiguous
ALTER TABLE "feature_flag_override" ADD CONSTRAINT "feature_flag_override_scope_check" CHECK (("userId" IS NOT NULL) <> ("teamId" IS NOT NULL));
