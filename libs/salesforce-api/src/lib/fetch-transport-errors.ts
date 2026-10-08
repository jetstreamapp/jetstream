import { ERROR_MESSAGES } from '@jetstream/shared/constants';

/**
 * Failures that happen before a single byte of the request is sent, so Salesforce cannot have applied
 * anything and a plain retry is safe. Anything not listed here is treated as possibly applied — telling a
 * user to retry an insert that actually landed is the expensive mistake, so unknown codes err that way.
 */
const NEVER_SENT_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT']);
// TLS handshake failures (expired certificates, intercepting corporate proxies) also fail before the request is sent.
const TLS_FAILURE_CODE_PATTERN = /CERT|^UNABLE_TO_|^ERR_TLS_|^ERR_SSL_/;
const TIMEOUT_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * Node's fetch (undici) collapses every transport failure into an opaque `TypeError: fetch failed`, or
 * `TypeError: terminated` when the connection drops while the response body is being read. Both reached
 * users verbatim ("Error saving permissions: fetch failed"). The real reason is on `error.cause`.
 *
 * Returns user-facing copy for a Salesforce callout that failed this way, or null for any other error.
 * Browser fetch failures are worded differently and carry no cause, so they are left alone.
 */
export function getSalesforceFetchFailureMessage(error: unknown): string | null {
  if (!(error instanceof Error) || (error.message !== 'fetch failed' && error.message !== 'terminated')) {
    return null;
  }
  const cause = (error.cause ?? {}) as { code?: string; message?: string };
  const code = cause.code ?? '';

  if (TIMEOUT_CODES.has(code)) {
    return ERROR_MESSAGES.SFDC_UPSTREAM_TIMEOUT;
  }
  // `terminated` means Salesforce had already started responding, so the request was processed
  if (error.message === 'terminated') {
    return ERROR_MESSAGES.SFDC_UPSTREAM_INTERRUPTED;
  }
  // A Salesforce hostname that no longer resolves is a deleted or refreshed org, not a network problem
  if (code === 'ENOTFOUND' && ERROR_MESSAGES.SFDC_ORG_DOES_NOT_EXIST.test(cause.message ?? '')) {
    return ERROR_MESSAGES.SFDC_ORG_NOT_FOUND;
  }
  if (NEVER_SENT_CODES.has(code) || TLS_FAILURE_CODE_PATTERN.test(code)) {
    return ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE;
  }
  return ERROR_MESSAGES.SFDC_UPSTREAM_INTERRUPTED;
}
