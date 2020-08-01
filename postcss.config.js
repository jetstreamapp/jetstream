module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    // ...(process.env.NODE_ENV === 'production'
    //   ? {
    //       '@fullhuman/postcss-purgecss': {
    //         // content: ['./apps/landing/pages/**/*.*', './apps/landing/components/**/*.*', './apps/landing/**/*.*'],
    //         content: ['./apps/landing/**/*.*'],
    //         defaultExtractor: (content) => content.match(/[\w-/.:]+(?<!:)/g) || [],
    //       },
    //     }
    //   : {}),
    'postcss-preset-env': { stage: 2 },
  },
};
