const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  env: {
    NX_PUBLIC_BILLING_ENABLED: process.env.NX_PUBLIC_BILLING_ENABLED,
    NX_PUBLIC_CLIENT_URL: process.env.NX_PUBLIC_CLIENT_URL,
    NX_PUBLIC_SERVER_URL: process.env.NX_PUBLIC_SERVER_URL,
    NX_PUBLIC_CAPTCHA_KEY: process.env.NX_PUBLIC_CAPTCHA_KEY,
    NX_GOOGLE_ANALYTICS_KEY: process.env.NX_GOOGLE_ANALYTICS_KEY,
    GOOGLE_APP_ID: process.env.GOOGLE_APP_ID,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  },
  // Rewrites are ignored by `output: 'export'`, so only register them for the dev server to avoid a build-time warning.
  ...(isDevelopment && {
    rewrites: async () => [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3333/api/:path*', // Proxy to Backend
        has: [
          {
            type: 'host',
            value: 'localhost',
          },
        ],
      },
    ],
  }),
  trailingSlash: true,
  output: 'export',
  distDir: '../../dist/apps/landing',
};

module.exports = nextConfig;
