import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAppCspDirectives, buildCspDirectives, buildHstsConfig } from '../security-headers';

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
    expect(directives.formAction).toContain('https://billing.getjetstream.app');
    expect(directives.formAction).toContain('https://billing.stripe.com');
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

  it('uses a nonce + host-allowlist script-src on the shared/landing policy (NOT strict-dynamic)', () => {
    // strict-dynamic would disable 'self' and block the statically-exported Next.js landing's
    // un-nonced /_next/static chunks, so the landing must keep 'self' + the host allowlist.
    const scriptSrc = buildCspDirectives().scriptSrc as string[];
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain('https://*.js.stripe.com');
  });

  it('uses a strict-dynamic script-src with a host-allowlist fallback on the /app policy', () => {
    const scriptSrc = buildAppCspDirectives().scriptSrc as string[];
    expect(scriptSrc).toContain("'strict-dynamic'");
    // Browsers without strict-dynamic support fall back to the shared third-party host
    // allowlist rather than a blanket https: scheme source; blob: is landing-only.
    expect(scriptSrc).not.toContain('https:');
    expect(scriptSrc).not.toContain('blob:');
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain('https://js.stripe.com');
  });

  it('builds a tighter /app img-src that drops legacy/landing-only hosts but keeps app hosts', () => {
    const appDirectives = buildAppCspDirectives(['accounts.google.com']);
    const sharedDirectives = buildCspDirectives(['accounts.google.com']);
    const appImgSrc = appDirectives.imgSrc as string[];

    // Excluded from /app: legacy Auth0 avatar hosts + landing CMS
    expect(appImgSrc).not.toContain('https://*.gravatar.com');
    expect(appImgSrc).not.toContain('https://*.githubusercontent.com');
    expect(appImgSrc).not.toContain('https://*.wp.com');
    expect(appImgSrc).not.toContain('https://*.ctfassets.net');

    // Retained for /app: hosts the app actually loads images from
    expect(appImgSrc).toContain('https://*.cloudinary.com');
    expect(appImgSrc).toContain('https://*.googleusercontent.com');
    expect(appImgSrc).toContain('https://*.salesforce.com');

    // The shared (landing) policy still includes them
    expect(sharedDirectives.imgSrc as string[]).toContain('https://*.gravatar.com');
    // frame-ancestors unchanged by the /app helper
    expect(appDirectives.frameAncestors).toEqual(sharedDirectives.frameAncestors);
  });

  it('replaces the broad Google wildcards in /app frame-src and connect-src with specific hosts', () => {
    const appDirectives = buildAppCspDirectives();
    const sharedDirectives = buildCspDirectives();
    const appFrameSrc = appDirectives.frameSrc as string[];
    const appConnectSrc = appDirectives.connectSrc as string[];

    // /app drops the broad Google wildcards...
    expect(appFrameSrc).not.toContain('https://*.google.com');
    expect(appFrameSrc).not.toContain('https://*.googleapis.com');
    expect(appConnectSrc).not.toContain('https://*.google.com');
    expect(appConnectSrc).not.toContain('https://*.googleapis.com');

    // ...and uses the specific Google hosts the app/picker actually needs
    expect(appFrameSrc).toContain('https://docs.google.com');
    expect(appFrameSrc).toContain('https://drive.google.com');
    expect(appConnectSrc).toContain('https://www.googleapis.com');
    expect(appConnectSrc).toContain('https://oauth2.googleapis.com');

    // Non-Google sources are retained on /app
    expect(appConnectSrc).toContain('https://api.stripe.com');
    expect(appConnectSrc).toContain('https://*.google-analytics.com');

    // The shared (landing) policy keeps the broad wildcards
    expect(sharedDirectives.frameSrc as string[]).toContain('https://*.google.com');
    expect(sharedDirectives.connectSrc as string[]).toContain('https://*.googleapis.com');
  });
});
