-- CreateTable
CREATE TABLE "mailgun_webhook_event" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "eventId" VARCHAR(255),
    "event" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "logLevel" VARCHAR(20),
    "recipient" VARCHAR(255) NOT NULL,
    "recipientDomain" VARCHAR(255) NOT NULL,
    "recipientProvider" VARCHAR(100),
    "subject" VARCHAR(500),
    "messageId" VARCHAR(255),
    "fromAddress" VARCHAR(255),
    "toAddress" VARCHAR(255),
    "messageSize" INTEGER,
    "deliveryCode" INTEGER,
    "deliveryMessage" VARCHAR(500),
    "deliveryDescription" VARCHAR(500),
    "deliveryEnhancedCode" VARCHAR(50),
    "deliveryAttemptNo" INTEGER,
    "deliveryMxHost" VARCHAR(255),
    "deliverySessionSeconds" DOUBLE PRECISION,
    "deliveryTls" BOOLEAN,
    "deliveryCertVerified" BOOLEAN,
    "envelopeSender" VARCHAR(255),
    "envelopeSendingIp" VARCHAR(50),
    "envelopeTransport" VARCHAR(20),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userVariables" JSON,
    "flags" JSON,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailgun_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_createdAt_idx" ON "mailgun_webhook_event"("createdAt");

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_event_createdAt_idx" ON "mailgun_webhook_event"("event", "createdAt");

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_recipient_createdAt_idx" ON "mailgun_webhook_event"("recipient", "createdAt");

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_recipientDomain_createdAt_idx" ON "mailgun_webhook_event"("recipientDomain", "createdAt");

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_deliveryCode_event_idx" ON "mailgun_webhook_event"("deliveryCode", "event");

-- CreateIndex
CREATE INDEX "mailgun_webhook_event_timestamp_idx" ON "mailgun_webhook_event"("timestamp");
