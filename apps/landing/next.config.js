const withSass = require('@zeit/next-sass');
const withImages = require('next-images');

module.exports = withImages(
  withSass({
    // Set this to true if you use CSS modules.
    // See: https://github.com/css-modules/css-modules
    cssModules: false,
  })
);
