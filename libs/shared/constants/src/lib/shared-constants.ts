/* eslint-disable @typescript-eslint/camelcase */
import { MapOf, MimeType } from '@jetstream/types';

export const SESSION_EXP_DAYS = 5;

export const HTTP = {
  COOKIE: {
    JETSTREAM: 'jetstream',
  },
  HEADERS: {
    ACCEPT: 'Accept',
    X_LOGOUT: 'X-AUTH-LOGOUT', // 1=true
    X_LOGOUT_URL: 'X-LOGOUT-URL',
    X_SFDC_ID: 'X-SFDC-ID',
    X_SFDC_LOGIN_URL: 'X-SFDC-LOGIN-URL',
    X_SFDC_INSTANCE_URL: 'X-SFDC-INSTANCE-URL',
    X_SFDC_ACCESS_TOKEN: 'X-SFDC-ACCESS-TOKEN',
    X_SFDC_API_VER: 'X-SFDC-API-VER',
    X_SFDC_NAMESPACE_PREFIX: 'X-SFDC-NAMESPACE-PREFIX',
  },
  CONTENT_TYPE: {
    JSON: 'application/json',
  },
};

export const MIME_TYPES: MapOf<MimeType> = {
  PLAN_TEXT: 'text/plain;charset=utf-8',
  CSV: 'text/csv;charset=utf-8',
};

export const YYYY_MM_DD = 'YYYY-MM-DD';
export const YYYY_MM_DD__HH_mm_ss = 'YYYY-MM-DD HH:mm:ss';
export const YYYY_MM_DD_HH_mm_ss_z = 'YYYY-MM-DDTHH:mm:ssZ';
