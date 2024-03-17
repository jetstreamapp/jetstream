const { composePlugins, withNx } = require('@nx/next');

const withImages = require('next-images');

// module.exports = withImages({
//   trailingSlash: true,
//   nx: {
//     svgr: false,
//   },
//   output: 'export',
//   distDir: '../../dist/apps/landing',
//   // #LAME https://github.com/nrwl/nx/issues/4182
//   // webpack(config) {
//   //   // Prevent nx from adding an svg handler - stick to what is provided by
//   //   // nextjs or that we have defined ourselves.
//   //   config.module.rules.push = (...items) => {
//   //     Array.prototype.push.call(config.module.rules, ...items.filter((item) => item.test.toString() !== '/\\.svg$/'));
//   //   };

//   //   return config;
//   // },
// });

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
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
