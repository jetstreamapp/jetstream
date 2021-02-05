import { InputAcceptTypeCsv, InputAcceptTypeExcel, InputAcceptTypeXml, InputAcceptTypeZip, MapOf, MimeType } from '@jetstream/types';

export const SESSION_EXP_DAYS = 5;
export const SFDC_BULK_API_NULL_VALUE = '#N/A';

export const FEATURE_FLAGS = Object.freeze({
  ALL: 'all',
  AUTOMATION_CONTROL: 'automation-control',
  QUERY: 'query',
  LOAD: 'load',
  PERMISSION_MANAGER: 'permission-manager',
  DEPLOYMENT: 'deployment',
});

export const INPUT_ACCEPT_FILETYPES: {
  ZIP: InputAcceptTypeZip;
  CSV: InputAcceptTypeCsv;
  EXCEL: InputAcceptTypeExcel;
  XML: InputAcceptTypeXml;
} = {
  ZIP: '.zip',
  CSV: '.csv',
  EXCEL: '.xlsx',
  XML: '.xml',
};

export const HTTP = {
  COOKIE: {
    JETSTREAM: 'jetstream',
  },
  HEADERS: {
    ACCEPT: 'Accept',
    X_LOGOUT: 'X-AUTH-LOGOUT', // 1=true
    X_LOGOUT_URL: 'X-LOGOUT-URL',
    X_SFDC_ID: 'X-SFDC-ID',
    X_SFDC_API_VERSION: 'X-SFDC-API-VERSION',
    X_SFDC_ID_TARGET: 'X-SFDC-ID-TARGET',
    X_SFDC_API_TARGET_VERSION: 'X-SFDC-API-TARGET-VERSION',
    X_SFDC_ORG_CONNECTION_ERROR: 'X-SFDC-ORG-CONNECTION-ERROR',
    X_SFDC_Session: 'X-SFDC-SESSION',
    X_CACHE_RESPONSE: 'X-CACHE-RESPONSE',
    X_CACHE_KEY: 'X-CACHE-KEY',
    X_CACHE_AGE: 'X-CACHE-AGE',
    X_CACHE_EXP: 'X-CACHE-ECP',
    CONTENT_TYPE: 'Content-Type',
    X_MOCK_KEY: 'X-MOCK-KEY',
    CONTENT_DISPOSITION: 'Content-Disposition',
  },
  CONTENT_TYPE: {
    JSON: 'application/json',
    XML: 'application/xml',
    XML_UTF8: 'application/xml; charset=UTF-8',
    CSV: 'text/csv; charset=UTF-8',
    ZIP: 'application/zip',
  },
};

export const ERROR_MESSAGES = {
  SFDC_EXPIRED_TOKEN: 'expired access/refresh token',
};

export const MIME_TYPES: MapOf<MimeType> = {
  PLAN_TEXT: 'text/plain;charset=utf-8',
  CSV: 'text/csv;charset=utf-8',
  XLSX: 'application/octet-stream;charset=utf-8',
  JSON: 'application/json;charset=utf-8',
  XML: 'text/xml;charset=utf-8',
  ZIP: 'application/zip;charset=utf-8',
};

export const INDEXED_DB = {
  KEYS: {
    queryHistory: 'HISTORY:QUERY',
    httpCache: 'HTTP:CACHE',
    userPreferences: 'USER:PREFERENCES',
  },
};

export const YYYY_MM_DD = 'YYYY-MM-DD'; // NOT DATE-FN COMPATIBLE
export const YYYY_MM_DD__HH_mm_ss = 'YYYY-MM-DD HH:mm:ss'; // NOT DATE-FN COMPATIBLE
export const YYYY_MM_DD_HH_mm_ss_z = 'YYYY-MM-DDTHH:mm:ssZ'; // NOT DATE-FN COMPATIBLE

export const DATE_FORMATS = {
  MM_DD_YYYY: 'MM/DD/YYYY', // NOT DATE-FN COMPATIBLE
  DD_MM_YYYY: 'DD/MM/YYYY', // NOT DATE-FN COMPATIBLE
  yyyy_MM_dd: 'yyyy-MM-dd',
  YYYY_MM_DD, // NOT DATE-FN COMPATIBLE
  YYYY_MM_DD__HH_mm_ss, // NOT DATE-FN COMPATIBLE
  YYYY_MM_DD_HH_mm_ss_z, // NOT DATE-FN COMPATIBLE
  YYYY_MM_DD_HH_mm_ss_a: 'yyyy-MM-dd h:mm:ss a',
  HH_mm_ss_ssss_z: `HH:mm:ss'.'SSSS'Z'`,
  HH_MM_SS_A: 'h:mm:ss A', // NOT DATE-FN COMPATIBLE
  HH_MM_SS_a: 'h:mm:ss a',
  FULL: 'MMMM do, yyyy hh:mm aa',
};
