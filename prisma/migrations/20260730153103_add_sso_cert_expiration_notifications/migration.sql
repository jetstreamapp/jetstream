-- AlterTable
ALTER TABLE "sso_saml_configurations" ADD COLUMN     "lastCertNotificationAt" TIMESTAMP(3),
ADD COLUMN     "nextCertNotificationDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sso_saml_configurations_nextCertNotificationDate_idx" ON "sso_saml_configurations"("nextCertNotificationDate");

-- Seed the certificate expiration reminder schedule for SAML configurations that already exist.
-- Without this, nextCertNotificationDate stays NULL on every pre-existing configuration, and NULL is
-- the cron's terminal "all reminders sent" state — so those teams would never be warned until an
-- admin happened to re-save their SSO configuration.
--
-- Configurations more than 30 days out are scheduled at their first (30 day) threshold. Everything
-- closer than that — including certificates that have already expired — becomes due on the next cron
-- run, which sends one catch-up notification and then advances through any remaining thresholds.
UPDATE "sso_saml_configurations"
SET "nextCertNotificationDate" = GREATEST("idpCertificateExpiresAt" - INTERVAL '30 days', NOW())
WHERE "idpCertificateExpiresAt" IS NOT NULL
  AND "nextCertNotificationDate" IS NULL;
