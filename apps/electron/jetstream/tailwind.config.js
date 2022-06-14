const colors = require('tailwindcss/colors');
const { join } = require('path');

module.exports = {
  purge: [join(__dirname, 'src/assets/*.html')],
  theme: {
    extend: {
      colors: {
        teal: colors.teal,
        cyan: colors.cyan,
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')],
};
