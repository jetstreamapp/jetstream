import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCspDirectives, buildHstsConfig } from '../security-headers';

const apiConfigMock = vi.hoisted(() => ({
  ENV: {
    ENVIRONMENT: 'staging',
    JETSTREAM_SERVER_URL: 'https://staging.jetstream-app.com',
  },
}));

vi.mock('@jetstream/api-config', () => apiConfigMock);

describe('security headers', () => {
  beforeEach(() => {
    apiConfigMock.ENV.ENVIRONMENT = 'staging';
    apiConfigMock.ENV.JETSTREAM_SERVER_URL = 'https://staging.jetstream-app.com';
  });

  it('enables HSTS for HTTPS staging without preload', () => {
    expect(buildHstsConfig()).toEqual({
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: false,
    });
  });

  it('enables HSTS preload only for the canonical production host', () => {
    apiConfigMock.ENV.ENVIRONMENT = 'production';
    apiConfigMock.ENV.JETSTREAM_SERVER_URL = 'https://getjetstream.app';

    expect(buildHstsConfig()).toEqual({
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: true,
    });
  });

  it('does not enable HSTS for non-HTTPS local development', () => {
    apiConfigMock.ENV.ENVIRONMENT = 'development';
    apiConfigMock.ENV.JETSTREAM_SERVER_URL = 'http://localhost:3333';

    expect(buildHstsConfig()).toBe(false);
  });

  it('defines explicit CSP directives with script nonce and Monaco-compatible style rules', () => {
    const directives = buildCspDirectives(['accounts.google.com']);
    const scriptSrc = directives.scriptSrc as Array<string | ((req: unknown, res: { locals: { cspNonce: string } }) => string)>;
    const nonceDirective = scriptSrc.find((directive) => typeof directive === 'function');

    expect(directives.defaultSrc).toEqual(["'self'"]);
    expect(directives.formAction).toContain('https://accounts.google.com');
    expect(directives.frameAncestors).toContain('accounts.google.com');
    expect(directives.fontSrc).not.toContain("'unsafe-inline'");
    expect(directives.frameSrc).toContain('https://*.googleapis.com');
    expect(directives.manifestSrc).toEqual(["'self'", 'https://*.cloudflareaccess.com']);
    expect(directives.objectSrc).toEqual(["'none'"]);
    expect(directives.scriptSrcAttr).toEqual(["'none'"]);
    expect(directives.styleSrc).toEqual(["'self'", 'https:', "'unsafe-inline'"]);
    expect(directives.styleSrcElem).toEqual(["'self'", 'https:', "'unsafe-inline'"]);
    expect(nonceDirective).toBeTypeOf('function');
    expect(typeof nonceDirective === 'function' ? nonceDirective({}, { locals: { cspNonce: 'test-nonce' } }) : null).toBe(
      "'nonce-test-nonce'",
    );
    expect(directives.styleSrcAttr).toEqual(["'unsafe-inline'"]);
  });
});
