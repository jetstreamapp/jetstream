-- CreateTable
CREATE TABLE "salesforce_canvas_org" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organizationId" VARCHAR(18) NOT NULL,
    "instanceUrl" VARCHAR NOT NULL,
    "myDomainBase" VARCHAR,
    "orgName" VARCHAR,
    "isSandbox" BOOLEAN,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "authorizedByUserId" UUID,
    "jetstreamUserId" UUID,
    "teamId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesforce_canvas_org_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salesforce_canvas_org_organizationId_key" ON "salesforce_canvas_org"("organizationId");

-- CreateIndex
CREATE INDEX "salesforce_canvas_org_myDomainBase_idx" ON "salesforce_canvas_org"("myDomainBase");

-- CreateIndex
CREATE INDEX "salesforce_canvas_org_jetstreamUserId_idx" ON "salesforce_canvas_org"("jetstreamUserId");

-- CreateIndex
CREATE INDEX "salesforce_canvas_org_teamId_idx" ON "salesforce_canvas_org"("teamId");

-- AddForeignKey
ALTER TABLE "salesforce_canvas_org" ADD CONSTRAINT "salesforce_canvas_org_jetstreamUserId_fkey" FOREIGN KEY ("jetstreamUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesforce_canvas_org" ADD CONSTRAINT "salesforce_canvas_org_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce exactly one owner per authorization (user XOR team); both-null rows are orphaned and both-set rows are ambiguous
ALTER TABLE "salesforce_canvas_org" ADD CONSTRAINT "salesforce_canvas_org_owner_check" CHECK (("jetstreamUserId" IS NOT NULL) <> ("teamId" IS NOT NULL));

-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN     "salesforceCanvas" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_entitlement" ADD COLUMN     "salesforceCanvas" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing paid users (identified by the chromeExtension entitlement) also get the Salesforce Canvas entitlement.
UPDATE "entitlement" SET "salesforceCanvas" = true WHERE "chromeExtension" = true;
UPDATE "team_entitlement" SET "salesforceCanvas" = true WHERE "chromeExtension" = true;
