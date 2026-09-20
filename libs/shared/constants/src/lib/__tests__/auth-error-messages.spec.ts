import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_MESSAGES, getAuthErrorMessage, isAuthErrorType, isLoginMethod } from '../shared-constants';

describe('getAuthErrorMessage', () => {
  describe('ProviderNotAllowed with allowed methods', () => {
    it('names the attempted method and the single allowed method', () => {
      expect(getAuthErrorMessage('ProviderNotAllowed', { attemptedMethod: 'salesforce', allowedMethods: ['sso'] })).toBe(
        `Salesforce sign-in isn't enabled for your team. Sign in with single sign-on, or contact your Jetstream administrator.`,
      );
    });

    it('joins two allowed methods with "or"', () => {
      expect(getAuthErrorMessage('ProviderNotAllowed', { attemptedMethod: 'salesforce', allowedMethods: ['google', 'credentials'] })).toBe(
        `Salesforce sign-in isn't enabled for your team. Sign in with Google or your email and password, or contact your Jetstream administrator.`,
      );
    });

    it('joins three or more allowed methods with commas', () => {
      expect(
        getAuthErrorMessage('ProviderNotAllowed', { attemptedMethod: 'salesforce', allowedMethods: ['google', 'credentials', 'sso'] }),
      ).toBe(
        `Salesforce sign-in isn't enabled for your team. Sign in with Google, your email and password, or single sign-on, or contact your Jetstream administrator.`,
      );
    });

    it('falls back to a generic subject when the attempted method is unknown', () => {
      expect(getAuthErrorMessage('ProviderNotAllowed', { allowedMethods: ['google'] })).toBe(
        `That login method isn't enabled for your team. Sign in with Google, or contact your Jetstream administrator.`,
      );
    });
  });

  describe('static messages', () => {
    it('uses the static ProviderNotAllowed copy when no allowed methods are provided', () => {
      expect(getAuthErrorMessage('ProviderNotAllowed')).toBe(AUTH_ERROR_MESSAGES.ProviderNotAllowed);
      expect(getAuthErrorMessage('ProviderNotAllowed', { allowedMethods: [] })).toBe(AUTH_ERROR_MESSAGES.ProviderNotAllowed);
    });

    it('ignores allowed methods for every other error type', () => {
      expect(getAuthErrorMessage('SsoRequired', { attemptedMethod: 'google', allowedMethods: ['sso'] })).toBe(
        AUTH_ERROR_MESSAGES.SsoRequired,
      );
    });

    it('falls back to the generic message for unknown or missing error types', () => {
      expect(getAuthErrorMessage('NotARealErrorType')).toBe(AUTH_ERROR_MESSAGES.AuthError);
      expect(getAuthErrorMessage(null)).toBe(AUTH_ERROR_MESSAGES.AuthError);
    });

    // The error type comes straight from a query param, so a lookup that resolves inherited members
    // would return a function or object and crash the render when React gets it as message text
    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf'])(
      'returns the generic message rather than an inherited member for "%s"',
      (errorType) => {
        expect(getAuthErrorMessage(errorType)).toBe(AUTH_ERROR_MESSAGES.AuthError);
      },
    );
  });
});

describe('isAuthErrorType', () => {
  it('accepts declared error types', () => {
    expect(isAuthErrorType('ProviderNotAllowed')).toBe(true);
    expect(isAuthErrorType('SsoRequired')).toBe(true);
  });

  it('rejects inherited object members and unknown values', () => {
    expect(['constructor', 'toString', '__proto__', 'valueOf'].some(isAuthErrorType)).toBe(false);
    expect(isAuthErrorType('NotARealErrorType')).toBe(false);
    expect(isAuthErrorType(null)).toBe(false);
    expect(isAuthErrorType(undefined)).toBe(false);
  });
});

describe('isLoginMethod', () => {
  it('accepts known login methods', () => {
    expect(['credentials', 'google', 'salesforce', 'sso'].every(isLoginMethod)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLoginMethod('saml')).toBe(false);
    expect(isLoginMethod('')).toBe(false);
    expect(isLoginMethod(null)).toBe(false);
    expect(isLoginMethod(undefined)).toBe(false);
  });
});
