-- CreateEnum
CREATE TYPE "AuthFactor" AS ENUM ('otp', 'email');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('credentials', 'google', 'salesforce');

-- CreateTable
CREATE TABLE "login_configuration" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "domains" VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR(255)[],
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "allowedMfaMethods" "AuthFactor"[] DEFAULT ARRAY['otp', 'email']::"AuthFactor"[],
    "allowedProviders" "AuthProvider"[] DEFAULT ARRAY['credentials', 'google', 'salesforce']::"AuthProvider"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_configuration_domains_idx" ON "login_configuration"("domains");
