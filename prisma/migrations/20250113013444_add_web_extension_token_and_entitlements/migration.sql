-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt";

-- CreateTable
CREATE TABLE "entitlement" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "recordSync" BOOLEAN NOT NULL DEFAULT false,
    "chromeExtension" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_extension_token" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_extension_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_userId_key" ON "entitlement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "web_extension_token_deviceId_key" ON "web_extension_token"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "web_extension_token_type_userId_deviceId_key" ON "web_extension_token"("type", "userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "web_extension_token_type_token_deviceId_key" ON "web_extension_token"("type", "token", "deviceId");

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_extension_token" ADD CONSTRAINT "web_extension_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Entitlements record for each user
INSERT INTO "entitlement" ("userId", "createdAt", "updatedAt")
SELECT "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId") DO NOTHING;
