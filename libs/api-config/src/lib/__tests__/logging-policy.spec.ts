import { describe, expect, it } from 'vitest';
import { getHttpLogLevel, resolveLogLevel } from '../logging-policy';

describe('logging policy', () => {
  describe('resolveLogLevel', () => {
    it('uses an explicit LOG_LEVEL when provided', () => {
      expect(resolveLogLevel({ logLevel: 'trace', environment: 'production' })).toBe('trace');
      expect(resolveLogLevel({ logLevel: 'warn', environment: 'development' })).toBe('warn');
    });

    it('defaults production to info', () => {
      expect(resolveLogLevel({ environment: 'production' })).toBe('info');
      expect(resolveLogLevel({ nodeEnv: 'production' })).toBe('info');
      expect(resolveLogLevel({})).toBe('info');
    });

    it('defaults non-production to debug', () => {
      expect(resolveLogLevel({ environment: 'development', nodeEnv: 'development' })).toBe('debug');
      expect(resolveLogLevel({ environment: 'test', nodeEnv: 'test' })).toBe('debug');
    });
  });

  describe('getHttpLogLevel', () => {
    it('logs non-500 responses at info', () => {
      expect(getHttpLogLevel({}, { statusCode: 200 })).toBe('info');
      expect(getHttpLogLevel({}, { statusCode: 400 })).toBe('info');
      expect(getHttpLogLevel({}, { statusCode: 404 })).toBe('info');
    });

    it('logs 500 responses and request errors at error', () => {
      expect(getHttpLogLevel({}, { statusCode: 500 })).toBe('error');
      expect(getHttpLogLevel({}, { statusCode: 503 })).toBe('error');
      expect(getHttpLogLevel({}, { statusCode: 200 }, new Error('socket closed'))).toBe('error');
    });
  });
});
