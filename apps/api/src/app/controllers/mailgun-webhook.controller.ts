import { DbCacheProvider, ENV, logger, prisma } from '@jetstream/api-config';
import { timingSafeStringCompare } from '@jetstream/auth/server';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import crypto from 'crypto';
import { z } from 'zod';
import type { Request, Response } from '../types/route.types';

// Shared cache for tracking used webhook tokens to prevent replay attacks across worker processes.
// Tokens expire after 15 minutes, same as our timestamp validation window.
const webhookTokenCache = new DbCacheProvider('mailgun:webhook-token', 1000 * 60 * 15);

// Maximum age for webhook timestamps (in seconds)
const MAX_TIMESTAMP_AGE_SECONDS = 60 * 15; // 15 minutes

// Mailgun webhook payload schema based on their documentation
const MailgunWebhookSignatureSchema = z.object({
  timestamp: z.string(),
  token: z.string(),
  signature: z.string(),
});

const MailgunDeliveryStatusSchema = z
  .object({
    code: z.number().optional(),
    message: z.string().optional(),
    description: z.string().optional(),
    'enhanced-code': z.string().optional(),
    'attempt-no': z.number().optional(),
    'mx-host': z.string().optional(),
    'session-seconds': z.number().optional(),
    tls: z.boolean().optional(),
    'certificate-verified': z.boolean().optional(),
  })
  .optional();

const MailgunEnvelopeSchema = z
  .object({
    sender: z.string().optional(),
    'sending-ip': z.string().optional(),
    transport: z.string().optional(),
    targets: z.string().optional(),
  })
  .optional();

const MailgunMessageHeadersSchema = z
  .object({
    to: z.string().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    'message-id': z.string().optional(),
  })
  .optional();

const MailgunMessageSchema = z
  .object({
    headers: MailgunMessageHeadersSchema,
    size: z.number().optional(),
    attachments: z.array(z.any()).optional(),
  })
  .optional();

const MailgunFlagsSchema = z
  .object({
    'is-test-mode': z.boolean().optional(),
    'is-routed': z.boolean().optional(),
    'is-authenticated': z.boolean().optional(),
    'is-system-test': z.boolean().optional(),
  })
  .optional();

const MailgunEventDataSchema = z.object({
  id: z.string().optional(),
  event: z.string(),
  timestamp: z.number(),
  'log-level': z.string().optional(),
  recipient: z.string(),
  'recipient-domain': z.string().optional(),
  'recipient-provider': z.string().optional(),
  'delivery-status': MailgunDeliveryStatusSchema,
  envelope: MailgunEnvelopeSchema,
  message: MailgunMessageSchema,
  flags: MailgunFlagsSchema,
  tags: z.array(z.string()).optional(),
  'user-variables': z.record(z.string(), z.any()).optional(),
});

const MailgunWebhookPayloadSchema = z.object({
  signature: MailgunWebhookSignatureSchema,
  'event-data': MailgunEventDataSchema,
});

/**
 * Mailgun relays free text from remote mail servers (bounce messages in particular) with no length limit, so every
 * value is clamped to its `@db.VarChar` size - one oversized field fails the whole insert, and Mailgun drops the
 * event for good once its retries are exhausted.
 */
function clampToColumn(value: string, maxLength: number): string;
function clampToColumn(value: string | undefined, maxLength: number): string | undefined;
function clampToColumn(value: string | undefined, maxLength: number): string | undefined {
  // `.length` counts UTF-16 code units, which is never fewer than the code points Postgres counts
  if (!value || value.length <= maxLength) {
    return value;
  }
  // VARCHAR(n) limits code points, so count and cut by code point - emoji are neither over-counted nor split mid-pair
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLength) {
    return value;
  }
  return `${codePoints.slice(0, maxLength - 1).join('')}…`;
}

export const routeDefinition = {
  webhook: {
    controllerFn: () => mailgunWebhookHandler,
  },
};

const mailgunWebhookHandler = async (req: Request, res: Response) => {
  try {
    // Parse and validate the webhook payload
    const rawBody = req.body as Buffer;
    const parseResult = MailgunWebhookPayloadSchema.safeParse(JSON.parse(rawBody.toString()));

    if (!parseResult.success) {
      logger.warn({ error: parseResult.error }, 'Invalid Mailgun webhook payload');
      return res.status(400).send('Invalid payload');
    }

    const { signature, 'event-data': eventData } = parseResult.data;

    // Verify webhook signature if signing key is configured
    if (ENV.MAILGUN_WEBHOOK_SIGNING_KEY) {
      // Check timestamp freshness to prevent replay attacks
      const timestampAge = Math.abs(Date.now() / 1000 - parseInt(signature.timestamp));
      if (timestampAge > MAX_TIMESTAMP_AGE_SECONDS) {
        logger.warn({ timestamp: signature.timestamp, age: timestampAge }, 'Mailgun webhook timestamp too old or too far in the future');
        return res.status(403).send('Invalid timestamp');
      }

      // Verify the signature
      const isValid = verifyWebhookSignature({
        timestamp: signature.timestamp,
        token: signature.token,
        signature: signature.signature,
        signingKey: ENV.MAILGUN_WEBHOOK_SIGNING_KEY,
      });

      if (!isValid) {
        logger.warn({ timestamp: signature.timestamp }, 'Invalid Mailgun webhook signature');
        return res.status(403).send('Invalid signature');
      }

      // Atomically reserve the token to prevent replay attacks across all worker processes.
      // consumeOnceAsync folds the existence check and the write into a single INSERT whose
      // primary-key conflict is the atomicity boundary, so concurrent duplicates cannot all
      // observe "not yet used" (the previous getAsync→saveAsync had a TOCTOU gap).
      const wasFirstUse = await webhookTokenCache.consumeOnceAsync(signature.token);
      if (!wasFirstUse) {
        // Log a hash instead of the raw token - it is enough to correlate replay attempts without persisting a payload secret.
        const tokenHash = crypto.createHash('sha256').update(signature.token).digest('hex').slice(0, 12);
        logger.warn({ tokenHash }, 'Mailgun webhook token already used (replay attack)');
        return res.status(403).send('Token already used');
      }
    } else {
      logger.warn('Mailgun webhook signing key not configured - skipping signature verification');
      return res.status(500).send('Webhook signing key not configured');
    }

    // Extract recipient domain from recipient email
    const recipientDomain = eventData['recipient-domain'] || eventData.recipient.split('@')[1] || 'unknown';

    // Store the webhook event in the database - clamp lengths must match the column sizes in prisma/schema.prisma
    await prisma.mailgunWebhookEvent.create({
      data: {
        // Event metadata
        eventId: clampToColumn(eventData.id, 255),
        event: clampToColumn(eventData.event, 50),
        timestamp: new Date(eventData.timestamp * 1000),
        logLevel: clampToColumn(eventData['log-level'], 20),

        // Recipient information
        recipient: clampToColumn(eventData.recipient, 255),
        recipientDomain: clampToColumn(recipientDomain, 255),
        recipientProvider: clampToColumn(eventData['recipient-provider'], 100),

        // Message information
        subject: clampToColumn(eventData.message?.headers?.subject, 2048),
        messageId: clampToColumn(eventData.message?.headers?.['message-id'], 255),
        fromAddress: clampToColumn(eventData.message?.headers?.from, 255),
        toAddress: clampToColumn(eventData.message?.headers?.to, 255),
        messageSize: eventData.message?.size,

        // Delivery status
        deliveryCode: eventData['delivery-status']?.code,
        deliveryMessage: clampToColumn(eventData['delivery-status']?.message, 2048),
        deliveryDescription: clampToColumn(eventData['delivery-status']?.description, 2048),
        deliveryEnhancedCode: clampToColumn(eventData['delivery-status']?.['enhanced-code'], 50),
        deliveryAttemptNo: eventData['delivery-status']?.['attempt-no'],
        deliveryMxHost: clampToColumn(eventData['delivery-status']?.['mx-host'], 255),
        deliverySessionSeconds: eventData['delivery-status']?.['session-seconds'],
        deliveryTls: eventData['delivery-status']?.tls,
        deliveryCertVerified: eventData['delivery-status']?.['certificate-verified'],

        // Envelope information
        envelopeSender: clampToColumn(eventData.envelope?.sender, 255),
        envelopeSendingIp: clampToColumn(eventData.envelope?.['sending-ip'], 50),
        envelopeTransport: clampToColumn(eventData.envelope?.transport, 20),

        // Metadata
        tags: eventData.tags || [],
        userVariables: eventData['user-variables'],
        flags: eventData.flags,
      },
    });

    res.status(200).end();
  } catch (err) {
    logger.error(getErrorMessageAndStackObj(err), 'Error processing Mailgun webhook');
    return res.status(500).send(`Error processing Mailgun webhook`);
  }
};

function verifyWebhookSignature({
  timestamp,
  token,
  signature,
  signingKey,
}: {
  timestamp: string;
  token: string;
  signature: string;
  signingKey: string;
}): boolean {
  const encodedToken = crypto.createHmac('sha256', signingKey).update(timestamp.concat(token)).digest('hex');
  // Constant-time comparison to avoid leaking the signature via timing (the `===` short-circuits early)
  return timingSafeStringCompare(encodedToken, signature);
}
