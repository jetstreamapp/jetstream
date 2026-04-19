import { ENV } from '@jetstream/api-config';
import type { Request, Response } from 'express';
import helmet from 'helmet';

type CspDirectiveValue = NonNullable<NonNullable<Parameters<typeof helmet.contentSecurityPolicy>[0]>['directives']>[string];
type CspDirectives = Record<string, Exclude<CspDirectiveValue, symbol>>;

export function buildCspDirectives(extraFrameAncestors: string[] = []): CspDirectives {
  const nonceDirective = (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`;

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: [
      "'self'",
      ENV.JETSTREAM_SERVER_URL,
      'https://*.google-analytics.com',
      'https://*.google.com',
      'https://*.googleapis.com',
      'https://*.gstatic.com',
      'https://*.rollbar.com',
      'https://api.amplitude.com',
      'https://api.cloudinary.com',
      'https://api.stripe.com',
      'https://challenges.cloudflare.com',
      'https://checkout.stripe.com',
      'https://cloudflareinsights.com',
      'https://connect-js.stripe.com',
      'https://hooks.stripe.com',
      'https://js.stripe.com',
      'https://maps.googleapis.com',
      'https://releases.getjetstream.app',
      'https://*.js.stripe.com',
      'wss:',
    ],
    fontSrc: ["'self'", 'data:', 'https://*.gstatic.com', 'https://checkout.stripe.com'],
    frameAncestors: ["'self'", ...extraFrameAncestors],
    frameSrc: [
      "'self'",
      'https://*.google.com',
      // required for Google Picker API iframe
      'https://*.googleapis.com',
      'https://*.googleusercontent.com',
      'https://accounts.google.com',
      'https://challenges.cloudflare.com',
      'https://checkout.stripe.com',
      'https://hooks.stripe.com',
      'https://js.stripe.com',
      'https://*.stripe.com',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https://*.cloudinary.com',
      'https://*.ctfassets.net',
      'https://*.documentforce.com',
      'https://*.force.com',
      'https://*.githubusercontent.com',
      'https://*.google-analytics.com',
      'https://*.googletagmanager.com',
      'https://*.googleusercontent.com',
      'https://*.gravatar.com',
      'https://*.gstatic.com',
      'https://*.salesforce.com',
      'https://*.wp.com',
      'https://*.stripe.com',
    ],
    // cloudflareaccess.com required when the app is fronted by Cloudflare Access, which rewrites the manifest URL
    manifestSrc: ["'self'", 'https://*.cloudflareaccess.com'],
    objectSrc: ["'none'"],
    scriptSrc: [
      "'self'",
      nonceDirective,
      'blob:',
      'https://*.google.com',
      'https://*.gstatic.com',
      'https://*.google-analytics.com',
      'https://*.googletagmanager.com',
      'https://challenges.cloudflare.com',
      'https://checkout.stripe.com',
      'https://connect-js.stripe.com',
      'https://js.stripe.com',
      'https://maps.googleapis.com',
      'https://static.cloudflareinsights.com',
      'https://*.js.stripe.com',
    ],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    // unsafe-inline required for monaco-editor
    styleSrcElem: ["'self'", 'https:', "'unsafe-inline'"],
    // unsafe-inline required for monaco-editor
    styleSrcAttr: ["'unsafe-inline'"],
    formAction: [
      "'self'",
      ENV.JETSTREAM_SERVER_URL,
      'https://accounts.google.com',
      'https://login.salesforce.com',
      'https://billing.stripe.com',
    ],
    upgradeInsecureRequests: ENV.ENVIRONMENT === 'development' ? null : [],
  };
}

export function buildHstsConfig() {
  if (!ENV.JETSTREAM_SERVER_URL.startsWith('https://')) {
    return false;
  }

  let hostname = '';
  try {
    hostname = new URL(ENV.JETSTREAM_SERVER_URL).hostname;
  } catch {
    hostname = '';
  }

  return {
    maxAge: 15_552_000,
    includeSubDomains: true,
    preload: ENV.ENVIRONMENT === 'production' && hostname === 'getjetstream.app',
  };
}
