module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          '@fullhuman/postcss-purgecss': {
            content: ['./apps/landing/pages/**/*.*', './apps/landing/**/*.*'],
            // defaultExtractor: (content) => content.match(/[\w-/.:]+(?<!:)/g) || [],
            // This is the function used to extract class names from your templates
            defaultExtractor: (content) => {
              // Capture as liberally as possible, including things like `h-(screen-1.5)`
              const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];

              // Capture classes within other delimiters like .block(class="w-1/2") in Pug
              const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];

              return broadMatches.concat(innerMatches);
            },
          },
        }
      : {}),
    'postcss-preset-env': { stage: 2 },
  },
};
