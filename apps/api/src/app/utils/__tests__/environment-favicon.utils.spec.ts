import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { environmentFaviconMiddleware, getEnvironmentFaviconPath } from '../environment-favicon.utils';

const FAVICON_PATHS = ['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/favicon-96x96.png'];

describe('getEnvironmentFaviconPath', () => {
  it.each(FAVICON_PATHS)('leaves %s untouched in production', (path) => {
    expect(getEnvironmentFaviconPath(path, 'production')).toBe(path);
  });

  it.each(['development', 'staging'] as const)('swaps every favicon in %s', (environment) => {
    expect(FAVICON_PATHS.map((path) => getEnvironmentFaviconPath(path, environment))).toEqual([
      `/favicon-${environment}.ico`,
      `/favicon-${environment}-16x16.png`,
      `/favicon-${environment}-32x32.png`,
      `/favicon-${environment}-96x96.png`,
    ]);
  });

  it('keeps the query string', () => {
    expect(getEnvironmentFaviconPath('/favicon-32x32.png?v=2', 'staging')).toBe('/favicon-staging-32x32.png?v=2');
  });

  it.each([
    '/apple-icon-57x57.png',
    '/android-icon-192x192.png',
    '/favicon-docs.ico',
    '/favicon-staging-32x32.png',
    '/favicon.ico.map',
    '/email/favicon-32x32.png',
    '/jetstream-logo.svg',
  ])('does not touch %s', (path) => {
    expect(getEnvironmentFaviconPath(path, 'staging')).toBe(path);
  });
});

describe('environmentFaviconMiddleware', () => {
  it('rewrites the request url and continues', () => {
    const req = { url: '/favicon-16x16.png' } as Request;
    const next = vi.fn();
    environmentFaviconMiddleware('development')(req, {} as Response, next);
    expect(req.url).toBe('/favicon-development-16x16.png');
    expect(next).toHaveBeenCalledWith();
  });
});
