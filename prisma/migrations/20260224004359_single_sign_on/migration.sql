-- CreateEnum
CREATE TYPE "SsoProvider" AS ENUM ('NONE', 'SAML', 'OIDC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthProvider" ADD VALUE 'saml';
ALTER TYPE "AuthProvider" ADD VALUE 'oidc';

-- AlterTable
ALTER TABLE "AuthIdentity" ADD COLUMN     "oidcConfigurationId" UUID,
ADD COLUMN     "samlConfigurationId" UUID;

-- AlterTable
ALTER TABLE "LoginActivity" ADD COLUMN     "teamId" UUID;

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "teamId" UUID;

-- AlterTable
ALTER TABLE "login_configuration" ADD COLUMN     "ssoBypassEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ssoBypassEnabledRoles" VARCHAR(50)[] DEFAULT ARRAY['ADMIN']::VARCHAR(50)[],
ADD COLUMN     "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ssoJitProvisioningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ssoProvider" "SsoProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "ssoRequireMfa" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "requireMfa" SET DEFAULT true,
ALTER COLUMN "allowIdentityLinking" SET DEFAULT false;

-- CreateTable
CREATE TABLE "sso_saml_configurations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL DEFAULT 'SAML Configuration',
    "loginConfigId" UUID NOT NULL,
    "entityId" TEXT NOT NULL,
    "acsUrl" TEXT NOT NULL,
    "singleLogoutUrl" TEXT,
    "idpEntityId" TEXT NOT NULL,
    "idpSsoUrl" TEXT NOT NULL,
    "idpCertificate" TEXT NOT NULL,
    "idpMetadataXml" TEXT,
    "idpMetadataUrl" TEXT,
    "nameIdFormat" TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    "signRequests" BOOLEAN NOT NULL DEFAULT false,
    "wantAssertionsSigned" BOOLEAN NOT NULL DEFAULT true,
    "spCertificate" TEXT,
    "spPrivateKey" TEXT,
    "attributeMapping" JSONB NOT NULL,
    "idpCertificateExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_saml_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_oidc_configurations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL DEFAULT 'OIDC Configuration',
    "loginConfigId" UUID NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "authorizationEndpoint" TEXT NOT NULL,
    "tokenEndpoint" TEXT NOT NULL,
    "userinfoEndpoint" TEXT,
    "jwksUri" TEXT NOT NULL,
    "endSessionEndpoint" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY['openid', 'email', 'profile']::TEXT[],
    "responseType" TEXT NOT NULL DEFAULT 'code',
    "attributeMapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_oidc_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_verification" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "domain" VARCHAR(255) NOT NULL,
    "teamId" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "verificationCode" VARCHAR(255) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT now() + interval '7 days',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_saml_configurations_loginConfigId_key" ON "sso_saml_configurations"("loginConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "sso_oidc_configurations_loginConfigId_key" ON "sso_oidc_configurations"("loginConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "domain_verification_domain_key" ON "domain_verification"("domain");

-- CreateIndex
CREATE INDEX "LoginActivity_teamId_createdAt_id_idx" ON "LoginActivity"("teamId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "audit_log_teamId_createdAt_idx" ON "audit_log"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_samlConfigurationId_fkey" FOREIGN KEY ("samlConfigurationId") REFERENCES "sso_saml_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_oidcConfigurationId_fkey" FOREIGN KEY ("oidcConfigurationId") REFERENCES "sso_oidc_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_saml_configurations" ADD CONSTRAINT "sso_saml_configurations_loginConfigId_fkey" FOREIGN KEY ("loginConfigId") REFERENCES "login_configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_oidc_configurations" ADD CONSTRAINT "sso_oidc_configurations_loginConfigId_fkey" FOREIGN KEY ("loginConfigId") REFERENCES "login_configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_verification" ADD CONSTRAINT "domain_verification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
