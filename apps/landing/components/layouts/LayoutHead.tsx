import Head from 'next/head';
import { useRouter } from 'next/router';

export const SITE_URL = 'https://getjetstream.app';

const DEFAULT_DESCRIPTION =
  'Jetstream is a Salesforce toolkit for admins and developers: SOQL query builder, data loader, permission and automation tools, and metadata deploy.';

// Absolute URL required by social crawlers; the file lives in libs/shared/assets and is served by the API
const OG_IMAGE = `${SITE_URL}/assets/images/website/jetstream-og-image.png`;

/**
 * Utility pages (auth flows, OAuth hand-offs, 404) that should never show up in search results.
 * Keep in sync with the `exclude` list in next-sitemap.config.js.
 * Sign in / sign up are intentionally indexable so branded searches like "jetstream login" land on them.
 */
const NOINDEX_PATH_PREFIXES = [
  '/404',
  '/auth/verify',
  '/auth/mfa-enroll',
  '/auth/accept-terms',
  '/auth/password-reset',
  '/auth/email-change',
  '/canvas-auth',
  '/desktop-app/auth',
  '/desktop-app/google-picker',
  '/goodbye',
  '/oauth-link',
  '/web-extension',
];

/**
 * JSON.stringify leaves `</script>` intact, so CMS content (blog titles, summaries) could close the
 * JSON-LD tag early and inject markup. `<` is still valid JSON and parses back to `<`.
 */
function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface LayoutHeadProps {
  title?: string;
  description?: string;
  /** Overrides the canonical url, which otherwise comes from the current route */
  url?: string;
  /** Open Graph type, use `article` for blog posts */
  type?: 'website' | 'article';
  /** schema.org JSON-LD objects describing the page, rendered as one script tag each */
  structuredData?: Array<Record<string, unknown>>;
}

export default function LayoutHead({
  title = 'Jetstream',
  description = DEFAULT_DESCRIPTION,
  url,
  type = 'website',
  structuredData = [],
}: LayoutHeadProps) {
  const router = useRouter();
  // Callers conventionally pass titles like "Pricing | Jetstream", only add the brand when it is missing
  const fullTitle = title.includes('Jetstream') ? title : `${title} | Jetstream`;
  // Strip query string and hash so tracking parameters never end up in the canonical url
  const [routePath] = router.asPath.split(/[?#]/);
  const canonicalUrl = url || `${SITE_URL}${routePath}`;
  const isNoIndex = NOINDEX_PATH_PREFIXES.some((prefix) => router.pathname.startsWith(prefix));

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {isNoIndex && <meta name="robots" content="noindex, follow" />}
      {!isNoIndex && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Jetstream" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      <link rel="icon" type="image/png" href="/assets/images/favicon.ico"></link>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <meta name="theme-color" content="#ffffff" />

      <link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />
      <link rel="apple-touch-icon" sizes="60x60" href="/assets/images/apple-icon-60x60.png" />
      <link rel="apple-touch-icon" sizes="72x72" href="/assets/images/apple-icon-72x72.png" />
      <link rel="apple-touch-icon" sizes="76x76" href="/assets/images/apple-icon-76x76.png" />
      <link rel="apple-touch-icon" sizes="114x114" href="/assets/images/apple-icon-114x114.png" />
      <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-icon-120x120.png" />
      <link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-icon-144x144.png" />
      <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-icon-152x152.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-icon-180x180.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-icon-192x192.png" />

      <link rel="manifest" href="/assets/images/manifest.json" />

      <meta name="msapplication-TileColor" content="#ffffff" />
      <meta name="msapplication-TileImage" content="/assets/images/ms-icon-144x144.png" />

      <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />

      {structuredData.map((data) => (
        <script key={String(data['@type'])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      ))}
    </Head>
  );
}
