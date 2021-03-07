module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
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

// Running in compatibility mode since I was getting the error
// TypeError: Invalid PostCSS Plugin found at: plugins[1]
// https://tailwindcss.com/docs/installation#post-css-7-compatibility-build
