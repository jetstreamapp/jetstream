import type * as Sentry from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { shouldIgnore } from '../errorTracker';

interface EventOptions {
  type?: string;
  value?: string;
  filenames?: string[];
}

function buildEvent({ type = 'Error', value, filenames = [] }: EventOptions): Sentry.ErrorEvent {
  return {
    exception: {
      values: [
        {
          type,
          value,
          stacktrace: { frames: filenames.map((filename) => ({ filename })) },
        },
      ],
    },
  } as Sentry.ErrorEvent;
}

const MONACO_BLOB_URL = 'blob:https://getjetstream.app/c7424921-6d50-4125-85d7-b0a71bd58fb8';
const SENTRY_INTERNAL_FRAME = '../../../node_modules/.pnpm/@sentry+core@10.69.0/node_modules/@sentry/core/build/esm/exports.js';

describe('shouldIgnore', () => {
  describe('monaco blob: worker script load failures', () => {
    it('ignores the raw Firefox NetworkError thrown from the blob: worker bootstrap', () => {
      const event = buildEvent({ value: 'NetworkError: A network error occurred.', filenames: [MONACO_BLOB_URL] });
      expect(shouldIgnore(event)).toBe(true);
    });

    it('ignores the worker ErrorEvent that Sentry wraps, whose frames are all Sentry internals', () => {
      const event = buildEvent({
        type: 'ErrorEvent',
        value: 'Event `ErrorEvent` captured as exception with message `NetworkError: A network error occurred.`',
        filenames: [SENTRY_INTERNAL_FRAME],
      });
      expect(shouldIgnore(event)).toBe(true);
    });

    it('ignores the Chromium wording for a failed importScripts', () => {
      const event = buildEvent({
        value: "Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'https://getjetstream.app/x.js' failed to load.",
        filenames: [MONACO_BLOB_URL],
      });
      expect(shouldIgnore(event)).toBe(true);
    });

    // The whole point of requiring a blob: frame — Firefox words a failed app fetch identically, and
    // those are real errors we still want to see.
    it('reports an identically worded NetworkError raised from app code', () => {
      const event = buildEvent({
        value: 'NetworkError: A network error occurred.',
        filenames: ['https://getjetstream.app/src-D6zgEThK.js'],
      });
      expect(shouldIgnore(event)).toBe(false);
    });

    it('reports an unrelated error that happens to originate in a blob: worker', () => {
      const event = buildEvent({ value: 'Cannot read properties of undefined', filenames: [MONACO_BLOB_URL] });
      expect(shouldIgnore(event)).toBe(false);
    });
  });

  describe('pre-existing rules', () => {
    it('ignores errors from monaco assets', () => {
      const event = buildEvent({
        value: 'Some monaco explosion',
        filenames: ['https://getjetstream.app/assets/js/monaco/vs/editor.main.js'],
      });
      expect(shouldIgnore(event)).toBe(true);
    });

    it('ignores errors originating in browser extensions', () => {
      const event = buildEvent({ value: 'Some extension explosion', filenames: ['chrome-extension://abc/content.js'] });
      expect(shouldIgnore(event)).toBe(true);
    });

    it('ignores known non-actionable messages', () => {
      expect(shouldIgnore(buildEvent({ value: 'socket hang up' }))).toBe(true);
      expect(shouldIgnore(buildEvent({ type: 'DatabaseClosedError' }))).toBe(true);
    });

    it('reports a genuine application error', () => {
      const event = buildEvent({ value: 'Cannot read properties of undefined', filenames: ['https://getjetstream.app/src-D6zgEThK.js'] });
      expect(shouldIgnore(event)).toBe(false);
    });
  });
});
