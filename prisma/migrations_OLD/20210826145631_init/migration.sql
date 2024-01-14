CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- CreateEnum
CREATE TYPE "salesforce_org_orglanguagelocalekey_enum" AS ENUM ('en_US', 'de', 'es', 'fr', 'it', 'ja', 'sv', 'ko', 'zh_TW', 'zh_CN', 'pt_BR', 'nl_NL', 'da', 'th', 'fi', 'ru', 'es_MX', 'no');

-- CreateTable
CREATE TABLE "salesforce_api" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "groupName" VARCHAR,
    "groupDescription" VARCHAR,
    "name" VARCHAR,
    "description" VARCHAR,
    "method" VARCHAR,
    "url" VARCHAR,
    "header" VARCHAR,
    "body" VARCHAR,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salesforce_org" (
    "id" SERIAL NOT NULL,
    "jetstreamUserId" VARCHAR NOT NULL,
    "uniqueId" VARCHAR NOT NULL,
    "filterText" VARCHAR NOT NULL,
    "accessToken" VARCHAR NOT NULL,
    "instanceUrl" VARCHAR NOT NULL,
    "loginUrl" VARCHAR NOT NULL,
    "userId" VARCHAR(18) NOT NULL,
    "email" VARCHAR NOT NULL,
    "organizationId" VARCHAR(18) NOT NULL,
    "username" VARCHAR NOT NULL,
    "displayName" VARCHAR NOT NULL,
    "thumbnail" VARCHAR,
    "apiVersion" VARCHAR,
    "orgName" VARCHAR,
    "orgCountry" VARCHAR,
    "orgInstanceName" VARCHAR,
    "orgIsSandbox" BOOLEAN,
    "orgLanguageLocaleKey" "salesforce_org_orglanguagelocalekey_enum",
    "orgNamespacePrefix" VARCHAR,
    "orgTrialExpirationDate" DATE,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "connectionError" VARCHAR,
    "jetstreamUrl" VARCHAR,
    "label" VARCHAR(100),
    "orgOrganizationType" VARCHAR,

    PRIMARY KEY ("id")
);

-- CreateTable
-- THIS WAS MODIFIED
CREATE TABLE "sessions" (
  "sid" varchar NOT NULL COLLATE "default",
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "sessions" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "sessions" ("expire");
