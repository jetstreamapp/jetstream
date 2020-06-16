export const REGEX = {
  LEADING_TRAILING_QUOTES: /(^")|("$)/g,
  NOT_ALPHA: /[^A-Za-z]/g,
  NOT_ALPHANUMERIC: /[^A-Za-z0-9]/g,
  VALID_EMAIL: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  SALESFORCE_ID: /[a-zA-Z0-9]{18}/,
};
