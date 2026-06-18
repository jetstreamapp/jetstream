import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'zlib';
import { extractDsnFromEnvelope, isDsnAllowed, parseSentryDsn, scrubEnvelope } from '../sentry-tunnel.utils';

// scrubEnvelope pulls scrubSensitiveEventData from @jetstream/api-config; mock it so the spec doesn't
// load the full api-config (env validation, db, sentry). The marker lets us assert which envelope
// items actually pass through the scrubber. Vitest hoists vi.mock above the imports above.
vi.mock('@jetstream/api-config', () => ({
  scrubSensitiveEventData: (event: Record<string, unknown>) => ({ ...event, _scrubbed: true }),
}));

describe('parseSentryDsn', () => {
  it('parses a SaaS DSN into the envelope ingest URL', () => {
    const parsed = parseSentryDsn('https://abc123@o555.ingest.sentry.io/456');
    expect(parsed).toEqual({
      dsn: 'https://abc123@o555.ingest.sentry.io/456',
      publicKey: 'abc123',
      host: 'o555.ingest.sentry.io',
      projectId: '456',
      envelopeUrl: 'https://o555.ingest.sentry.io/api/456/envelope/',
    });
  });

  it('supports a self-hosted path prefix', () => {
    expect(parseSentryDsn('https://abc@example.com/base/456')?.envelopeUrl).toBe('https://example.com/base/api/456/envelope/');
  });

  it('rejects non-https, missing public key, missing project id, and garbage', () => {
    expect(parseSentryDsn('http://abc@o555.ingest.sentry.io/456')).toBeNull();
    expect(parseSentryDsn('https://o555.ingest.sentry.io/456')).toBeNull();
    expect(parseSentryDsn('https://abc@o555.ingest.sentry.io')).toBeNull();
    expect(parseSentryDsn('not-a-url')).toBeNull();
  });
});

describe('extractDsnFromEnvelope', () => {
  const dsn = 'https://abc@o555.ingest.sentry.io/456';

  it('reads the dsn from the envelope header line', () => {
    const body = Buffer.from(`${JSON.stringify({ dsn })}\n{"type":"event"}\n{"message":"hi"}\n`);
    expect(extractDsnFromEnvelope(body)).toBe(dsn);
  });

  it('reads the dsn from a gzipped envelope', () => {
    const body = gzipSync(Buffer.from(`${JSON.stringify({ dsn })}\n{"type":"event"}\n{}\n`));
    expect(extractDsnFromEnvelope(body, 'gzip')).toBe(dsn);
  });

  it('returns null when the header has no dsn or is unparseable', () => {
    expect(extractDsnFromEnvelope(Buffer.from('{"sdk":{}}\n{}\n'))).toBeNull();
    expect(extractDsnFromEnvelope(Buffer.from('not json\n'))).toBeNull();
  });
});

describe('isDsnAllowed', () => {
  const dsn = 'https://abc@o555.ingest.sentry.io/456';

  it('allows only exact matches and trims whitespace', () => {
    expect(isDsnAllowed(dsn, [dsn])).toBe(true);
    expect(isDsnAllowed(`  ${dsn}  `, [dsn])).toBe(true);
    expect(isDsnAllowed(dsn, ['https://other@o1.ingest.sentry.io/9'])).toBe(false);
  });

  it('rejects everything when the allowlist is empty (SSRF guard, closed by default)', () => {
    expect(isDsnAllowed(dsn, [])).toBe(false);
  });
});

describe('scrubEnvelope', () => {
  it('scrubs event item payloads while preserving the header verbatim', () => {
    const header = `{"event_id":"e1"}`;
    const body = Buffer.from(`${header}\n{"type":"event"}\n{"message":"hi"}\n`);
    const result = scrubEnvelope(body);
    expect(result).not.toBeNull();
    const text = result!.toString('utf8');
    expect(text.startsWith(`${header}\n{"type":"event"}\n`)).toBe(true);
    expect(text).toContain('"_scrubbed":true'); // event payload passed through the scrubber
  });

  it('leaves non-event items untouched', () => {
    const body = Buffer.from(`{"event_id":"e1"}\n{"type":"session"}\n{"status":"ok"}\n`);
    const text = scrubEnvelope(body)!.toString('utf8');
    expect(text).toContain('{"status":"ok"}');
    expect(text).not.toContain('_scrubbed');
  });

  it('bails (returns null → forward original) on gzip and on length-prefixed items', () => {
    expect(scrubEnvelope(Buffer.from('anything'), 'gzip')).toBeNull();
    const withAttachment = Buffer.from(`{"event_id":"e1"}\n{"type":"attachment","length":5}\nbytes\n`);
    expect(scrubEnvelope(withAttachment)).toBeNull();
  });
});
