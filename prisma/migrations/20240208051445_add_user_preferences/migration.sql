-- CreateTable
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "skipFrontdoorLogin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill all records with a default UserPreference record
INSERT INTO "UserPreference" ("userId", "skipFrontdoorLogin", "createdAt", "updatedAt")
SELECT "id", false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "User"
WHERE NOT EXISTS (
    SELECT 1 FROM "UserPreference"
    WHERE "UserPreference"."userId" = "User"."id"
);
