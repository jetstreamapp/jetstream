/* eslint-disable @typescript-eslint/no-var-requires */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  purge: ['./apps/landing/pages/**/*.tsx', './apps/landing/pages/**/*.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Salesforce Sans', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  variants: {},
  plugins: [require('@tailwindcss/ui')],
};
