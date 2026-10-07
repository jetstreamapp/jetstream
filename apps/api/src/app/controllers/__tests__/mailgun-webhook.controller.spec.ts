/**
 * Mailgun relays bounce text from remote mail servers verbatim, and a single value longer than its column used to fail
 * the insert with a 500 - Mailgun retries 8 times and then drops the event. These tests lock in that every string is
 * clamped to its column size so the event is always stored.
 */
import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeDefinition } from '../mailgun-webhook.controller';

const SIGNING_KEY = 'test-signing-key';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consumeOnceAsync: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { MAILGUN_WEBHOOK_SIGNING_KEY: 'test-signing-key' },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: { mailgunWebhookEvent: { create: mocks.create } },
  DbCacheProvider: class {
    consumeOnceAsync = mocks.consumeOnceAsync;
  },
}));

vi.mock('@jetstream/auth/server', () => ({
  timingSafeStringCompare: (a: string, b: string) => a === b,
}));

const handler = routeDefinition.webhook.controllerFn();

function createRequest(eventData: Record<string, unknown>) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const token = crypto.randomUUID();
  const signature = crypto.createHmac('sha256', SIGNING_KEY).update(timestamp.concat(token)).digest('hex');
  return { body: Buffer.from(JSON.stringify({ signature: { timestamp, token, signature }, 'event-data': eventData })) } as any;
}

function createResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res;
}

const baseEventData = {
  id: 'event-id',
  event: 'failed',
  timestamp: 1_791_299_488,
  recipient: 'recipient@example.com',
};

describe('mailgunWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeOnceAsync.mockResolvedValue(true);
    mocks.create.mockResolvedValue({});
  });

  it('clamps oversized free text to the column size instead of failing the insert', async () => {
    const res = createResponse();
    await handler(
      createRequest({
        ...baseEventData,
        message: { headers: { subject: 's'.repeat(5000), to: `${'t'.repeat(300)}@example.com` } },
        'delivery-status': { message: 'm'.repeat(5000), description: 'd'.repeat(2048), 'enhanced-code': '5.7.1' },
        envelope: { 'sending-ip': 'i'.repeat(60) },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = mocks.create.mock.calls[0][0];
    expect(data.subject).toHaveLength(2048);
    expect(data.subject.endsWith('…')).toBe(true);
    expect(data.deliveryMessage).toHaveLength(2048);
    expect(data.toAddress).toHaveLength(255);
    expect(data.envelopeSendingIp).toHaveLength(50);
    // Values that already fit are stored untouched
    expect(data.deliveryDescription).toBe('d'.repeat(2048));
    expect(data.deliveryEnhancedCode).toBe('5.7.1');
    expect(data.recipient).toBe('recipient@example.com');
  });

  it('measures and truncates by code point, matching how VARCHAR counts characters', async () => {
    const res = createResponse();
    await handler(
      createRequest({
        ...baseEventData,
        // 1500 emoji is 3000 UTF-16 code units but only 1500 characters, so it fits VARCHAR(2048)
        message: { headers: { subject: '😀'.repeat(1500) } },
        'delivery-status': { message: '😀'.repeat(3000) },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = mocks.create.mock.calls[0][0];
    expect(data.subject).toBe('😀'.repeat(1500));
    expect(Array.from(data.deliveryMessage)).toHaveLength(2048);
    expect(data.deliveryMessage).toBe(`${'😀'.repeat(2047)}…`);
  });

  it('leaves optional fields that were not sent undefined', async () => {
    const res = createResponse();
    await handler(createRequest(baseEventData), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = mocks.create.mock.calls[0][0];
    expect(data.subject).toBeUndefined();
    expect(data.deliveryMessage).toBeUndefined();
    expect(data.recipientDomain).toBe('example.com');
  });
});
