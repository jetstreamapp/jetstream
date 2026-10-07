-- AlterTable
ALTER TABLE "mailgun_webhook_event" ALTER COLUMN "subject" SET DATA TYPE VARCHAR(2048),
ALTER COLUMN "deliveryMessage" SET DATA TYPE VARCHAR(2048),
ALTER COLUMN "deliveryDescription" SET DATA TYPE VARCHAR(2048);
