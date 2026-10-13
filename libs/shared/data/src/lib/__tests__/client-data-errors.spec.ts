import { describe, expect, it } from 'vitest';
import { ApiRequestError, isTransientRequestFailure, REQUEST_CANCELED_MESSAGE } from '../client-data-errors';

describe('isTransientRequestFailure', () => {
  it.each([null, 429, 500, 502, 503, 504])('treats a %s status as transient', (status) => {
    expect(isTransientRequestFailure(new ApiRequestError('failed', status))).toBe(true);
  });

  it.each([400, 401, 403, 404])('treats a %s status as a rejection', (status) => {
    expect(isTransientRequestFailure(new ApiRequestError('failed', status))).toBe(false);
  });

  it('does not treat a canceled request as transient', () => {
    expect(isTransientRequestFailure(new ApiRequestError(REQUEST_CANCELED_MESSAGE, null))).toBe(false);
  });

  it('does not treat errors that never reached the network as transient', () => {
    expect(isTransientRequestFailure(new Error('failed'))).toBe(false);
  });
});
