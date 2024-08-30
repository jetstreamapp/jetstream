const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  trailingSlash: true,
  env: {
    NX_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NX_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NX_PUBLIC_CLIENT_URL: process.env.NX_PUBLIC_CLIENT_URL,
    NX_PUBLIC_LANDING_PAGE_URL: process.env.NX_PUBLIC_CLIENT_URL,
  },
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
