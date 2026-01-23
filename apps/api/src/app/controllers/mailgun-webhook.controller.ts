import { ENV, logger, prisma } from '@jetstream/api-config';
import type { Request, Response } from '@jetstream/api-types';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';

// Cache for tracking used webhook tokens to prevent replay attacks
// Tokens expire after 15 minutes, same as our timestamp validation window
const WEBHOOK_TOKEN_CACHE = new LRUCache<string, boolean>({
  max: 10000, // Store up to 10k recent tokens
  ttl: 1000 * 60 * 15, // 15 minutes
});

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
        logger.warn(
          { timestamp: signature.timestamp, age: timestampAge },
          'Mailgun webhook timestamp too old or too far in the future',
        );
        return res.status(403).send('Invalid timestamp');
      }

      // Check if this token has already been used (replay attack prevention)
      if (WEBHOOK_TOKEN_CACHE.has(signature.token)) {
        logger.warn({ token: signature.token }, 'Mailgun webhook token already used (replay attack)');
        return res.status(403).send('Token already used');
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

      // Cache the token to prevent replay attacks
      WEBHOOK_TOKEN_CACHE.set(signature.token, true);
    } else {
      logger.warn('Mailgun webhook signing key not configured - skipping signature verification');
      return res.status(500).send('Webhook signing key not configured');
    }

    // Extract recipient domain from recipient email
    const recipientDomain = eventData['recipient-domain'] || eventData.recipient.split('@')[1] || 'unknown';

    // Store the webhook event in the database
    await prisma.mailgunWebhookEvent.create({
      data: {
        // Event metadata
        eventId: eventData.id,
        event: eventData.event,
        timestamp: new Date(eventData.timestamp * 1000),
        logLevel: eventData['log-level'],

        // Recipient information
        recipient: eventData.recipient,
        recipientDomain,
        recipientProvider: eventData['recipient-provider'],

        // Message information
        subject: eventData.message?.headers?.subject,
        messageId: eventData.message?.headers?.['message-id'],
        fromAddress: eventData.message?.headers?.from,
        toAddress: eventData.message?.headers?.to,
        messageSize: eventData.message?.size,

        // Delivery status
        deliveryCode: eventData['delivery-status']?.code,
        deliveryMessage: eventData['delivery-status']?.message,
        deliveryDescription: eventData['delivery-status']?.description,
        deliveryEnhancedCode: eventData['delivery-status']?.['enhanced-code'],
        deliveryAttemptNo: eventData['delivery-status']?.['attempt-no'],
        deliveryMxHost: eventData['delivery-status']?.['mx-host'],
        deliverySessionSeconds: eventData['delivery-status']?.['session-seconds'],
        deliveryTls: eventData['delivery-status']?.tls,
        deliveryCertVerified: eventData['delivery-status']?.['certificate-verified'],

        // Envelope information
        envelopeSender: eventData.envelope?.sender,
        envelopeSendingIp: eventData.envelope?.['sending-ip'],
        envelopeTransport: eventData.envelope?.transport,

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
  return encodedToken === signature;
}
