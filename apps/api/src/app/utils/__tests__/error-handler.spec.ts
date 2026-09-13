import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { describe, expect, it, vi } from 'vitest';
import { UserFacingError } from '../error-handler';

vi.mock('@jetstream/api-config', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/** Shape Node/undici produces: an opaque TypeError with the real reason hanging off `cause`. */
function buildFetchFailure(code?: string) {
  const error = new TypeError('fetch failed');
  error.cause = code ? Object.assign(new Error('upstream blew up'), { code }) : undefined;
  return error;
}

describe('UserFacingError upstream fetch failures', () => {
  it('replaces an undici headers timeout with copy that does not claim the operation failed', () => {
    const error = new UserFacingError(buildFetchFailure('UND_ERR_HEADERS_TIMEOUT'));

    expect(error.message).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_TIMEOUT);
    expect(error.message).not.toContain('fetch failed');
    // The whole point: the write may have landed, so the user must check before retrying.
    expect(error.message).toContain('may still have been applied');
  });

  it('treats UND_ERR_BODY_TIMEOUT as a timeout', () => {
    expect(new UserFacingError(buildFetchFailure('UND_ERR_BODY_TIMEOUT')).message).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_TIMEOUT);
  });

  // A connect timeout means the request never reached Salesforce, so nothing can have been applied
  // and the user should just retry — the opposite of what the timeout copy tells them to do.
  it.each(['ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'])('reports %s as unreachable rather than as a timeout', (code) => {
    expect(new UserFacingError(buildFetchFailure(code)).message).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE);
  });

  it('reports a fetch failure with no cause as unreachable rather than leaking the raw message', () => {
    expect(new UserFacingError(buildFetchFailure()).message).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE);
  });

  it('leaves unrelated errors untouched', () => {
    expect(new UserFacingError(new Error('Required field missing')).message).toBe('Required field missing');
    expect(new UserFacingError('A plain string message').message).toBe('A plain string message');
  });

  it('still scrubs raw XML error bodies', () => {
    expect(new UserFacingError(new Error('<?xml version="1.0"?><Errors />')).message).toBe('An unexpected error has occurred');
  });
});
