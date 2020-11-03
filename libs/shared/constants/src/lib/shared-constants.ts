/* eslint-disable @typescript-eslint/camelcase */
import { InputAcceptTypeCsv, InputAcceptTypeExcel, InputAcceptTypeZip, MapOf, MimeType } from '@jetstream/types';

export const SESSION_EXP_DAYS = 5;
export const SFDC_BULK_API_NULL_VALUE = '#N/A';

export const FEATURE_FLAGS = {
  ALL: 'all',
  AUTOMATION_CONTROL: 'automation-control',
  QUERY: 'query',
  LOAD: 'load',
};

export const INPUT_ACCEPT_FILETYPES: {
  ZIP: InputAcceptTypeZip;
  CSV: InputAcceptTypeCsv;
  EXCEL: InputAcceptTypeExcel;
} = {
  ZIP: '.zip',
  CSV: '.csv',
  EXCEL: '.xlsx',
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
    X_SFDC_ORG_CONNECTION_ERROR: 'X-SFDC-ORG-CONNECTION-ERROR',
    X_SFDC_Session: 'X-SFDC-SESSION',
    X_CACHE_RESPONSE: 'X-CACHE-RESPONSE',
    X_CACHE_KEY: 'X-CACHE-KEY',
    X_CACHE_AGE: 'X-CACHE-AGE',
    X_CACHE_EXP: 'X-CACHE-ECP',
    CONTENT_TYPE: 'Content-Type',
    CONTENT_DISPOSITION: 'Content-Disposition',
  },
  CONTENT_TYPE: {
    JSON: 'application/json',
    XML: 'application/xml',
    XML_UTF8: 'application/xml; charset=UTF-8',
    CSV: 'text/csv; charset=UTF-8',
  },
};

export const ERROR_MESSAGES = {
  SFDC_EXPIRED_TOKEN: 'expired access/refresh token',
};

export const MIME_TYPES: MapOf<MimeType> = {
  PLAN_TEXT: 'text/plain;charset=utf-8',
  CSV: 'text/csv;charset=utf-8',
  XLSX: 'application/octet-stream;charset=utf-8',
};

export const INDEXED_DB = {
  KEYS: {
    queryHistory: 'HISTORY:QUERY',
    httpCache: 'HTTP:CACHE',
  },
};

export const YYYY_MM_DD = 'YYYY-MM-DD';
export const YYYY_MM_DD__HH_mm_ss = 'YYYY-MM-DD HH:mm:ss';
export const YYYY_MM_DD_HH_mm_ss_z = 'YYYY-MM-DDTHH:mm:ssZ';

export const DATE_FORMATS = {
  MM_DD_YYYY: 'MM/DD/YYYY',
  DD_MM_YYYY: 'DD/MM/YYYY',
  yyyy_MM_dd: 'yyyy-MM-dd',
  YYYY_MM_DD,
  YYYY_MM_DD__HH_mm_ss,
  YYYY_MM_DD_HH_mm_ss_z,
  YYYY_MM_DD_HH_mm_ss_a: 'yyyy-MM-dd h:mm:ss a',
  HH_mm_ss_ssss_z: `HH:mm:ss'.'SSSS'Z'`,
  HH_MM_SS_A: 'h:mm:ss A',
  HH_MM_SS_a: 'h:mm:ss a',
};
