import type { ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { shouldIgnoreErrorEvent } from '../errorTracker';

const BLOB_URL = 'blob:https://getjetstream.app/d75d3a2e-0679-4968-933c-1cdde631b8c5';
const SENTRY_FRAME = { filename: 'https://getjetstream.app/errorTracker-CzdaioqL.js' };

function errorEvent(type: string, value: string, filenames: string[]): ErrorEvent {
  return {
    type: undefined,
    exception: { values: [{ type, value, stacktrace: { frames: filenames.map((filename) => ({ filename })) } }] },
  };
}

describe('shouldIgnoreErrorEvent', () => {
  it('ignores a worker that fails to load from a blob: URL in Firefox', () => {
    expect(shouldIgnoreErrorEvent(errorEvent('Error', 'NetworkError: A network error occurred.', [BLOB_URL]))).toBe(true);
  });

  it('ignores the same failure re-thrown as an ErrorEvent', () => {
    const value = 'Event `ErrorEvent` captured as exception with message `NetworkError: A network error occurred.`';
    expect(shouldIgnoreErrorEvent(errorEvent('ErrorEvent', value, [SENTRY_FRAME.filename]))).toBe(true);
  });

  it('reports a network error thrown by app code', () => {
    expect(shouldIgnoreErrorEvent(errorEvent('Error', 'NetworkError: A network error occurred.', [SENTRY_FRAME.filename]))).toBe(false);
  });

  it('reports other errors from blob: scripts', () => {
    expect(shouldIgnoreErrorEvent(errorEvent('TypeError', 'x is undefined', [BLOB_URL]))).toBe(false);
  });
});
