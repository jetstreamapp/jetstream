const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  env: {
    NX_PUBLIC_BILLING_ENABLED: process.env.NX_PUBLIC_BILLING_ENABLED,
    NX_PUBLIC_CLIENT_URL: process.env.NX_PUBLIC_CLIENT_URL,
    NX_PUBLIC_SERVER_URL: process.env.NX_PUBLIC_SERVER_URL,
    NX_PUBLIC_CAPTCHA_KEY: process.env.NX_PUBLIC_CAPTCHA_KEY,
    NX_GOOGLE_ANALYTICS_KEY: process.env.NX_GOOGLE_ANALYTICS_KEY,
  },
  rewrites: async () => {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    return [
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
    ];
  },
  trailingSlash: true,
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  output: 'export',
  distDir: '../../dist/apps/landing',
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
