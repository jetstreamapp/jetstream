import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  emailActivity: { create: vi.fn() },
}));

const loggerMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));

const mailgunCreateMessage = vi.hoisted(() => vi.fn());

// Mutable so the "client not configured" case can re-import the module with the key unset —
// the Mailgun client is built once at module load.
const envMock = vi.hoisted(() => ({
  MAILGUN_API_KEY: 'test-key' as string | undefined,
  JETSTREAM_EMAIL_DOMAIN: 'mail.example.com',
  JETSTREAM_EMAIL_FROM_NAME: 'Jetstream <noreply@example.com>',
  JETSTREAM_EMAIL_REPLY_TO: 'support@example.com',
}));

vi.mock('mailgun.js', () => ({
  default: class MailgunMock {
    client() {
      return { messages: { create: mailgunCreateMessage } };
    }
  },
}));
vi.mock('../api-db-config', () => ({ prisma: prismaMock }));
vi.mock('../api-logger', () => ({ logger: loggerMock }));
vi.mock('../env-config', () => ({ ENV: envMock }));

const emailArgs = { to: 'user@example.com', subject: 'Test Subject', html: '<p>body</p>', text: 'body' };

/** Resolves only after a macrotask, so a caller that fails to await is observably out of order. */
function createSlowInsert(order: string[]) {
  return vi.fn().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    order.push('insert-complete');
    return { id: 1 };
  });
}

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.MAILGUN_API_KEY = 'test-key';
    mailgunCreateMessage.mockResolvedValue({ status: 200, id: '<message-id>' });
  });

  it('records the send in email_activity', async () => {
    const { sendEmail } = await import('../email.config');
    prismaMock.emailActivity.create.mockResolvedValue({ id: 1 });

    await sendEmail(emailArgs);

    expect(prismaMock.emailActivity.create).toHaveBeenCalledWith({
      data: { email: 'user@example.com', subject: 'Test Subject', status: '200', providerId: '<message-id>' },
      select: { id: true },
    });
  });

  // Regression: the insert used to be fire-and-forget, so every cron task's `process.exit(0)` killed it
  // before Postgres committed and no automated mail was ever recorded.
  it('does not resolve until the email_activity insert has committed', async () => {
    const order: string[] = [];
    const { sendEmail } = await import('../email.config');
    prismaMock.emailActivity.create.mockImplementation(createSlowInsert(order));

    await sendEmail(emailArgs);
    order.push('send-resolved');

    expect(order).toEqual(['insert-complete', 'send-resolved']);
  });

  it('does not resolve until the insert has committed when the mail client is not configured', async () => {
    const order: string[] = [];
    envMock.MAILGUN_API_KEY = undefined;
    vi.resetModules();
    const { sendEmail } = await import('../email.config');
    prismaMock.emailActivity.create.mockImplementation(createSlowInsert(order));

    await sendEmail(emailArgs);
    order.push('send-resolved');

    expect(order).toEqual(['insert-complete', 'send-resolved']);
    expect(prismaMock.emailActivity.create).toHaveBeenCalledWith({
      data: { email: 'user@example.com', subject: 'Test Subject', status: 'unsent' },
      select: { id: true },
    });
    expect(mailgunCreateMessage).not.toHaveBeenCalled();
    vi.resetModules();
  });

  it('still resolves when logging the activity fails so delivery is never broken by it', async () => {
    const { sendEmail } = await import('../email.config');
    prismaMock.emailActivity.create.mockRejectedValue(new Error('db unavailable'));

    await expect(sendEmail(emailArgs)).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalledWith({ message: 'db unavailable' }, '[EMAIL][ERROR] Error logging email activity');
  });
});
