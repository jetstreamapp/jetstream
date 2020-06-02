module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          '@fullhuman/postcss-purgecss': {
            content: ['./components/**/*.*', './pages/**/*.*', './contexts/**/*.*', './gql/**/*.*', './utils/**/*.*', './public/**/*.*'],
            defaultExtractor: (content) => content.match(/[\w-/.:]+(?<!:)/g) || [],
          },
        }
      : {}),
    'postcss-preset-env': { stage: 2 },
  },
};

console.log('process.env.NODE_ENV', process.env.NODE_ENV);
