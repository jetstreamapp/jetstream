import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDevClientOriginFromRequest } from '../oauth.utils';

const apiConfigMock = vi.hoisted(() => ({
  ENV: {
    ENVIRONMENT: 'development',
  },
}));

vi.mock('@jetstream/api-config', () => apiConfigMock);

function mockRequest(headers: Record<string, string>) {
  return { get: (name: string) => headers[name.toLowerCase()] } as Parameters<typeof getDevClientOriginFromRequest>[0];
}

describe('getDevClientOriginFromRequest', () => {
  beforeEach(() => {
    apiConfigMock.ENV.ENVIRONMENT = 'development';
  });

  it('returns the origin of the dev server that opened the popup', () => {
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://localhost:4210/app/home' }))).toBe('http://localhost:4210');
  });

  it('accepts the default dev server port and a port-less localhost', () => {
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://localhost:4200/app' }))).toBe('http://localhost:4200');
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://localhost/app' }))).toBe('http://localhost');
  });

  it('falls back to the origin header when there is no referer', () => {
    expect(getDevClientOriginFromRequest(mockRequest({ origin: 'http://localhost:4211' }))).toBe('http://localhost:4211');
  });

  it('rejects origins that are not localhost', () => {
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'https://evil.example.com/app' }))).toBeNull();
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://localhost.evil.example.com/app' }))).toBeNull();
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://notlocalhost:4210/app' }))).toBeNull();
  });

  it('rejects everything outside of development', () => {
    apiConfigMock.ENV.ENVIRONMENT = 'production';
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'http://localhost:4210/app' }))).toBeNull();
  });

  it('returns null when the referer is missing or unparseable', () => {
    expect(getDevClientOriginFromRequest(mockRequest({}))).toBeNull();
    expect(getDevClientOriginFromRequest(mockRequest({ referer: 'not-a-url' }))).toBeNull();
  });
});
