-- AlterTable
ALTER TABLE "salesforce_org" ADD COLUMN     "jetstreamOrganizationId" UUID;

-- CreateTable
CREATE TABLE "jetstream_organization" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jetstream_organization_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "jetstream_organization" ADD CONSTRAINT "jetstream_organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesforce_org" ADD CONSTRAINT "salesforce_org_jetstreamOrganizationId_fkey" FOREIGN KEY ("jetstreamOrganizationId") REFERENCES "jetstream_organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
