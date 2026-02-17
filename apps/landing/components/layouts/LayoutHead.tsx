import Head from 'next/head';
import { useRouter } from 'next/router';

const DESCRIPTION =
  'Jetstream is a powerful suite of Salesforce administration tools built for Salesforce admins, developers, and power users. Manage, query, and update Salesforce data faster with an advanced SOQL query builder, a high-performance data loader, and productivity features designed for real-world Salesforce workflows.';

const OG_IMAGE = 'https://res.cloudinary.com/getjetstream/image/upload/v1771094335/public/jetstream-og-image_chejpi.png';
const SITE_URL = 'https://getjetstream.app';

export default function LayoutHead({ title = 'Jetstream', url }: { title?: string; url?: string }) {
  const router = useRouter();
  const fullTitle = title === 'Jetstream' ? title : `${title} | Jetstream`;
  // Automatically construct the canonical URL from the current route if not provided
  const canonicalUrl = url || `${SITE_URL}${router.asPath}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={DESCRIPTION} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Jetstream" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="twitter:image" content={OG_IMAGE} />

      <link rel="icon" type="image/png" href="/images/favicon.ico"></link>
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
      <meta name="msapplication-TileImage" content="/images/ms-icon-144x144.png" />

      <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Jetstream',
            description: DESCRIPTION,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, Windows, macOS, Linux',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://getjetstream.app',
          }),
        }}
      />
    </Head>
  );
}
