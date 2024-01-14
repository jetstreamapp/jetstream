-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "nickname" TEXT,
    "picture" TEXT,
    "appMetadata" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "salesforce_api" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupName" TEXT,
    "groupDescription" TEXT,
    "name" TEXT,
    "description" TEXT,
    "method" TEXT,
    "url" TEXT,
    "header" TEXT,
    "body" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "salesforce_org" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jetstreamUserId" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "filterText" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "instanceUrl" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "thumbnail" TEXT,
    "apiVersion" TEXT,
    "orgName" TEXT,
    "orgCountry" TEXT,
    "orgInstanceName" TEXT,
    "orgIsSandbox" BOOLEAN,
    "orgLanguageLocaleKey" TEXT,
    "orgNamespacePrefix" TEXT,
    "orgTrialExpirationDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "connectionError" TEXT,
    "jetstreamUrl" TEXT,
    "label" TEXT,
    "orgOrganizationType" TEXT,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalyticsSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "salesforce_org_jetstreamUserId_jetstreamUrl_uniqueId_key" ON "salesforce_org"("jetstreamUserId", "jetstreamUrl", "uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSummary_type_key" ON "AnalyticsSummary"("type");
