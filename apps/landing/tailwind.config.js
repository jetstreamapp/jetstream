const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');
const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'pages/**/*.{js,ts,jsx,tsx}'),
    join(__dirname, 'components/**/*.{js,ts,jsx,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        teal: colors.teal,
        cyan: colors.cyan,
        blue: {
          50: '#eef4ff',
          100: '#d8e6fe',
          200: '#aacbff',
          300: '#78b0fd',
          400: '#57a3fd',
          500: '#1b96ff',
          600: '#0176d3',
          700: '#0b5cab',
          800: '#014486',
          900: '#032d60',
          950: '#001639',
        },
      },
      fontFamily: {
        sans: ['Salesforce Sans', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')],
};
