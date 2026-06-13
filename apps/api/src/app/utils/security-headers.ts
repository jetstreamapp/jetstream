import { ENV } from '@jetstream/api-config';
import type { Request, Response } from 'express';
import helmet from 'helmet';

type CspDirectiveValue = NonNullable<NonNullable<Parameters<typeof helmet.contentSecurityPolicy>[0]>['directives']>[string];
type CspDirectives = Record<string, Exclude<CspDirectiveValue, symbol>>;

// Derive the app's own WebSocket origin (e.g. wss://getjetstream.app) so connect-src can
// allowlist exactly the socket.io endpoint instead of every `wss:` host on the internet.
function getWebSocketOrigin(): string | null {
  try {
    const serverUrl = new URL(ENV.JETSTREAM_SERVER_URL);
    const wsProtocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${serverUrl.host}`;
  } catch {
    return null;
  }
}

const nonceDirective = (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`;

export function buildCspDirectives(extraFrameAncestors: string[] = []): CspDirectives {
  const isDevelopment = ENV.ENVIRONMENT === 'development';
  const webSocketOrigin = getWebSocketOrigin();

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
      'https://*.betterstackdata.com',
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
      // Scope WebSocket connections to the app's own origin instead of a blanket `wss:`.
      // In development the socket server runs on localhost over an arbitrary port.
      ...(isDevelopment ? ['ws://localhost:*', 'wss://localhost:*'] : webSocketOrigin ? [webSocketOrigin] : []),
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
    // Shared/landing script-src: nonce + 'self' (covers the statically-exported Next.js landing's
    // same-origin /_next/static chunks) + a third-party host allowlist.
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
    // Monaco and the Jobs/download web workers are created from blob: URLs. Worker creation resolves
    // worker-src -> child-src -> default-src (never script-src), so declaring these explicitly lets us
    // keep blob: OUT of script-src (where it would be a page-level script sink) while workers still load.
    workerSrc: ["'self'", 'blob:'],
    childSrc: ["'self'", 'blob:'],
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
      'https://billing.getjetstream.app',
      'https://billing.stripe.com',
    ],
    upgradeInsecureRequests: ENV.ENVIRONMENT === 'development' ? null : [],
    // CSP violation reporting. `report-to` is the modern mechanism (paired with the
    // Reporting-Endpoints response header set by setPermissionPolicy); `report-uri` is retained
    // as a fallback for browsers that do not yet support report-to.
    reportUri: ['/api/csp-report'],
    reportTo: ['csp-endpoint'],
  };
}

// Image hosts the authenticated /app never originates content from, so they are removed from the
// /app img-src (tightening it to reality and keeping marketing-CDN wildcards off the surface that
// customer scanners hit). These are landing/marketing-site and stale Auth0-era avatar hosts:
//   - Contentful (ctfassets) / WordPress (wp.com): public marketing-site CMS only.
//   - Gravatar / GitHub avatars (githubusercontent): carried over from the old Auth0 social-login
//     setup. A production audit of AuthIdentity.picture confirms NO stored avatar uses these — every
//     real avatar is on Salesforce (*.force.com / *.documentforce.com) or Google (*.googleusercontent.com),
//     all of which are retained below. The avatar <img>s also fall back to a default on load error.
const IMG_SOURCES_EXCLUDED_FROM_APP = [
  'https://*.ctfassets.net',
  'https://*.githubusercontent.com',
  'https://*.wp.com',
  'https://*.gravatar.com',
];

// Broad Google wildcards that the /app does NOT need — the SPA only ever calls specific Google hosts
// directly, and the Google Drive Picker runs as a popup served by the desktop/web-extension picker
// routes (it is never framed inline in /app), so /app needs only its own Sign-In / gapi / Drive /
// OAuth / OIDC endpoints. `*.gstatic.com`, `*.google-analytics.com`, `*.googletagmanager.com` are
// left untouched (Fonts / Maps static / analytics, not Drive-Picker related).
const APP_GOOGLE_WILDCARDS = ['https://*.google.com', 'https://*.googleapis.com'];
const APP_GOOGLE_FRAME_SRC = [
  'https://accounts.google.com',
  'https://apis.google.com',
  'https://content.googleapis.com',
  'https://docs.google.com',
  'https://drive.google.com',
];
const APP_GOOGLE_CONNECT_SRC = [
  'https://accounts.google.com',
  'https://apis.google.com',
  'https://content.googleapis.com',
  'https://www.googleapis.com',
  'https://oauth2.googleapis.com',
  'https://openidconnect.googleapis.com',
];

// Replace the broad Google wildcards in a directive with a specific host allowlist (deduped).
function narrowGoogleWildcards(sources: CspDirectives[string], specificHosts: string[]): CspDirectives[string] {
  if (!Array.isArray(sources)) {
    return sources;
  }
  const result = sources.filter((source) => !APP_GOOGLE_WILDCARDS.includes(source as string));
  for (const host of specificHosts) {
    if (!result.includes(host)) {
      result.push(host);
    }
  }
  return result;
}

/**
 * CSP directives for the authenticated SPA (/app). Tighter than the shared policy: legacy/landing-only
 * image hosts removed, and the broad Google wildcards in frame-src/connect-src replaced with the
 * specific Google hosts the app actually uses (matching the desktop/web-extension picker routes).
 */
export function buildAppCspDirectives(extraFrameAncestors: string[] = []): CspDirectives {
  const directives = buildCspDirectives(extraFrameAncestors);
  const { imgSrc, scriptSrc } = directives;
  return {
    ...directives,
    // The SPA's entry/chunk <script> tags are all nonce-tagged at build time (Vite cspNoncePlugin),
    // so 'strict-dynamic' is safe here. Browsers with strict-dynamic support ignore the inherited
    // host allowlist; older browsers (no strict-dynamic) fall back to it instead of a blanket
    // `https:` scheme source. blob: stays out of the /app script-src — workers load via worker-src.
    scriptSrc: ["'strict-dynamic'", ...(Array.isArray(scriptSrc) ? scriptSrc.filter((source) => source !== 'blob:') : [])],
    imgSrc: Array.isArray(imgSrc) ? imgSrc.filter((source) => !IMG_SOURCES_EXCLUDED_FROM_APP.includes(source as string)) : imgSrc,
    frameSrc: narrowGoogleWildcards(directives.frameSrc, APP_GOOGLE_FRAME_SRC),
    connectSrc: narrowGoogleWildcards(directives.connectSrc, APP_GOOGLE_CONNECT_SRC),
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
