export const REGEX = {
  LEADING_TRAILING_QUOTES: /(^")|("$)/g,
  NOT_NUMERIC: /[^0-9]/g,
  NOT_ALPHA: /[^A-Za-z]/g,
  NOT_ALPHANUMERIC: /[^A-Za-z0-9]/g,
  NOT_ALPHANUMERIC_OR_UNDERSCORE: /[^A-Za-z0-9_]/g,
  VALID_EMAIL: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  SALESFORCE_ID: /[a-zA-Z0-9]{18}/,
  NOT_UNSIGNED_NUMERIC: /[^0-9]/g,
  // SAFE_FILENAME: /[^a-zA-Z0-9-\.]/g,
  SAFE_FILENAME: /[\/\?<>\\:\*\|"]/g,
  ISO_DATE: /[0-9]{4}-[0-9]{2}-[0-9]{2}($|T[0-9]{2}| [0-9]{2}(\+[0-9]{2}:[0-9]{2}|z|-[0-9]{4}|:[0-9]{2}:[0-9]{2}\.[0-9]{3}\+[0-9]{2}($|:[0-9]{2})|$|:[0-9]{2}($|:[0-9]{2}($|.[0-9]{3}))))/,
  BOOLEAN_STR_TRUE: /^t|^1/i,
};
