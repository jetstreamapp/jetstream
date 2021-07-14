import { InputAcceptTypeCsv, InputAcceptTypeExcel, InputAcceptTypeXml, InputAcceptTypeZip, MapOf, MimeType } from '@jetstream/types';

export const ORG_VERSION_PLACEHOLDER = '_DEFAULT_VERSION_';

export const SESSION_EXP_DAYS = 5;
export const SFDC_BULK_API_NULL_VALUE = '#N/A';

export const FEATURE_FLAGS = Object.freeze({
  ALL: 'all',
  AUTOMATION_CONTROL: 'automation-control',
  QUERY: 'query',
  LOAD: 'load',
  LOAD_MULTI_OBJ: 'load-multi-object',
  PERMISSION_MANAGER: 'permission-manager',
  DEPLOYMENT: 'deployment',
  NOTIFICATIONS: 'notifications',
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
    X_FORWARDED_FOR: 'X-FORWARDED-FOR',
    CONTENT_DISPOSITION: 'Content-Disposition',
    CF_Connecting_IP: 'CF-Connecting-IP',
    CF_IPCountry: 'CF-IPCountry',
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
  SFDC_EXPIRED_TOKEN_VALIDITY: 'token validity expired',
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
    apexHistory: 'HISTORY:APEX',
    salesforceApiHistory: 'HISTORY:SALESFORCE_API',
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

export const ANALYTICS_KEYS = {
  /** QUERY */
  query_BulkDelete: 'query_BulkDelete',
  query_CopyToClipboard: 'query_CopyToClipboard',
  query_DownloadResults: 'query_DownloadResults',
  query_ExecuteQuery: 'query_ExecuteQuery',
  query_HelpClicked: 'query_HelpClicked',
  query_HistoryChangeOrgs: 'query_HistoryChangeOrgs',
  query_HistoryExecute: 'query_HistoryExecute',
  query_HistoryModalOpened: 'query_HistoryModalOpened',
  query_HistoryRestore: 'query_HistoryRestore',
  query_HistorySaveQueryToggled: 'query_HistorySaveQueryToggled',
  query_HistoryShowMore: 'query_HistoryShowMore',
  query_HistoryTypeChanged: 'query_HistoryTypeChanged',
  query_LoadMore: 'query_LoadMore',
  query_ManualQueryOpened: 'query_ManualQueryOpened',
  query_ManualSoqlOpened: 'query_ManualSoqlOpened',
  query_MetadataQueryToggled: 'query_MetadataQueryToggled',
  query_RecordAction: 'query_RecordAction',
  query_ResetPage: 'query_ResetPage',
  /** LOAD */
  load_GoBackToPrevStep: 'load_GoBackToPrevStep',
  load_MappingAutomationChanged: 'load_MappingAutomationChanged',
  load_MappingFilterChanged: 'load_MappingFilterChanged',
  load_MappingRowPreviewChanged: 'load_MappingRowPreviewChanged',
  load_StartOver: 'load_StartOver',
  load_Submitted: 'load_Submitted',
  /** ANON APEX */
  apex_Submitted: 'apex_Submitted',
  /** SFDC API */
  sfdcApi_Submitted: 'sfdcApi_Submitted',
  sfdcApi_Sample: 'sfdcApi_Sample',
  /** DEPLOY */
  deploy_addToChangeset: 'deploy_addToChangeset',
  deploy_configuration: 'deploy_configuration',
  deploy_deployMetadata: 'deploy_deployMetadata',
  deploy_download: 'deploy_download',
  deploy_downloadMetadataPkg: 'deploy_downloadMetadataPkg',
  deploy_finished: 'deploy_finished',
};

export const LOG_LEVELS = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];
