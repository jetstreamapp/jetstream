import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import { getSalesforceFetchFailureMessage } from '../fetch-transport-errors';

/** Shape Node/undici produces: an opaque TypeError with the real reason hanging off `cause`. */
function buildTransportFailure({
  code,
  causeMessage,
  message = 'fetch failed',
}: {
  code?: string;
  causeMessage?: string;
  message?: string;
}) {
  const error = new TypeError(message);
  error.cause = code ? Object.assign(new Error(causeMessage ?? 'upstream blew up'), { code }) : undefined;
  return error;
}

describe('getSalesforceFetchFailureMessage', () => {
  it.each(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'])('reports %s as a timeout that may have been applied', (code) => {
    expect(getSalesforceFetchFailureMessage(buildTransportFailure({ code }))).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_TIMEOUT);
  });

  // These can happen after Salesforce received the request, so a plain "try again" could duplicate a write
  it.each(['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE', 'ETIMEDOUT', 'SOME_FUTURE_CODE'])(
    'reports %s as interrupted rather than unreachable',
    (code) => {
      expect(getSalesforceFetchFailureMessage(buildTransportFailure({ code }))).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_INTERRUPTED);
    },
  );

  it('reports a fetch failure with no cause as interrupted', () => {
    expect(getSalesforceFetchFailureMessage(buildTransportFailure({}))).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_INTERRUPTED);
  });

  it('reports a body that was cut off mid-read as interrupted', () => {
    const error = buildTransportFailure({ message: 'terminated', code: 'UND_ERR_SOCKET' });
    expect(getSalesforceFetchFailureMessage(error)).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_INTERRUPTED);
  });

  it.each([
    'ECONNREFUSED',
    'EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT',
    'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ])('reports %s as unreachable, since the request was never sent', (code) => {
    expect(getSalesforceFetchFailureMessage(buildTransportFailure({ code }))).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE);
  });

  it('reports an unresolvable Salesforce hostname as a missing org', () => {
    const error = buildTransportFailure({ code: 'ENOTFOUND', causeMessage: 'getaddrinfo ENOTFOUND acme--uat.sandbox.my.salesforce.com' });
    expect(getSalesforceFetchFailureMessage(error)).toBe(ERROR_MESSAGES.SFDC_ORG_NOT_FOUND);
  });

  it('reports an unresolvable non-Salesforce hostname as unreachable', () => {
    const error = buildTransportFailure({ code: 'ENOTFOUND', causeMessage: 'getaddrinfo ENOTFOUND proxy.corp.example' });
    expect(getSalesforceFetchFailureMessage(error)).toBe(ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE);
  });

  it('leaves other errors alone', () => {
    expect(getSalesforceFetchFailureMessage(new Error('Required field missing'))).toBeNull();
    // Browser fetch wording — the web clients are not undici and carry no cause
    expect(getSalesforceFetchFailureMessage(new TypeError('Failed to fetch'))).toBeNull();
    expect(getSalesforceFetchFailureMessage('fetch failed')).toBeNull();
  });
});
