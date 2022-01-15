import { InputAcceptTypeCsv, InputAcceptTypeExcel, InputAcceptTypeXml, InputAcceptTypeZip, MapOf, MimeType } from '@jetstream/types';

export const ORG_VERSION_PLACEHOLDER = '_DEFAULT_VERSION_';

export const SESSION_EXP_DAYS = 5;
export const SFDC_BULK_API_NULL_VALUE = '#N/A';

export const FEATURE_FLAGS = Object.freeze({
  ALL: 'all',
  AUTOMATION_CONTROL: 'automation-control',
  AUTOMATION_CONTROL_NEW: 'automation-control-new',
  QUERY: 'query',
  LOAD: 'load',
  LOAD_MULTI_OBJ: 'load-multi-object',
  PERMISSION_MANAGER: 'permission-manager',
  DEPLOYMENT: 'deployment',
  NOTIFICATIONS: 'notifications',
  ALLOW_GOOGLE_UPLOAD: 'allow-google-upload',
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
    X_INCLUDE_CALL_OPTIONS: 'X_INCLUDE_CALL_OPTIONS',
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
    ZIP_CSV: 'zip/csv',
    ZIP: 'application/zip',
  },
};

export const ERROR_MESSAGES = {
  SFDC_EXPIRED_TOKEN: 'expired access/refresh token',
  SFDC_EXPIRED_TOKEN_VALIDITY: 'token validity expired',
};

export const MIME_TYPES: {
  PLAN_TEXT: MimeType;
  CSV: MimeType;
  XLSX: MimeType;
  XLSX_OPEN_OFFICE: MimeType;
  JSON: MimeType;
  XML: MimeType;
  ZIP: MimeType;
  GSHEET: MimeType;
} = {
  PLAN_TEXT: 'text/plain;charset=utf-8',
  CSV: 'text/csv;charset=utf-8',
  XLSX: 'application/octet-stream;charset=utf-8',
  XLSX_OPEN_OFFICE: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  JSON: 'application/json;charset=utf-8',
  XML: 'text/xml;charset=utf-8',
  ZIP: 'application/zip;charset=utf-8',
  GSHEET: 'application/vnd.google-apps.spreadsheet',
};

export const fileExtToMimeType = {
  csv: MIME_TYPES.CSV,
  xlsx: MIME_TYPES.XLSX,
  json: MIME_TYPES.JSON,
  xml: MIME_TYPES.XML,
  zip: MIME_TYPES.ZIP,
};

export const fileExtToGoogleDriveMimeType = {
  csv: MIME_TYPES.GSHEET,
  xlsx: MIME_TYPES.GSHEET,
  json: MIME_TYPES.PLAN_TEXT,
  xml: MIME_TYPES.PLAN_TEXT,
  zip: MIME_TYPES.ZIP,
};

export const INDEXED_DB = {
  KEYS: {
    automationControlHistory: 'AUTOMATION:QUERY',
    queryHistory: 'HISTORY:QUERY',
    apexHistory: 'HISTORY:APEX',
    salesforceApiHistory: 'HISTORY:SALESFORCE_API',
    recordHistory: 'HISTORY:RECORDS',
    httpCache: 'HTTP:CACHE',
    userPreferences: 'USER:PREFERENCES',
    sobjectExportSelection: 'USER:SOBJECT_EXPORT_OPTIONS',
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
  /** Browser Notifications */
  notifications_modal_opened: 'notifications_modal_opened',
  notifications_permission_requested: 'notifications_permission_requested',
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
  /** DOWNLOAD FILES */
  attachment_QueriedEligibleObject: 'attachment_QueriedEligibleObject',
  attachment_ModalOpened: 'attachment_ModalOpened',
  attachment_Cancelled: 'attachment_Cancelled',
  attachment_Downloaded: 'attachment_Downloaded',
  attachment_Error: 'attachment_Error',
  /** LOAD */
  load_GoBackToPrevStep: 'load_GoBackToPrevStep',
  load_MappingAutomationChanged: 'load_MappingAutomationChanged',
  load_MappingFilterChanged: 'load_MappingFilterChanged',
  load_MappingRowPreviewChanged: 'load_MappingRowPreviewChanged',
  load_StartOver: 'load_StartOver',
  load_Submitted: 'load_Submitted',
  load_ViewRecords: 'load_ViewRecords',
  load_DownloadRecords: 'load_DownloadRecords',
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
  /** CREATE FIELDS */
  sobj_create_field_export_fields: 'sobj_create_field_export_fields',
  sobj_create_field_export_example: 'sobj_create_field_export_example',
  sobj_create_field_import_fields: 'sobj_create_field_import_fields',
  sobj_create_field_reset_rows: 'sobj_create_field_reset_rows',
  sobj_create_field_submit_modal_opened: 'sobj_create_field_submit_modal_opened',
  sobj_create_field_deploy: 'sobj_create_field_deploy',
  sobj_create_field_export_results: 'sobj_create_field_export_results',
  /** Platform Event */
  platform_event_subscribed: 'platform_event_subscribed',
  platform_event_unsubscribe: 'platform_event_unsubscribe',
  platform_event_publish: 'platform_event_publish',
  /** Settings */
  settings_update_user: 'settings_update_user',
  settings_link_account: 'settings_link_account',
  settings_unlink_account: 'settings_unlink_account',
  settings_resend_email_verification: 'settings_resend_email_verification',
  settings_delete_account: 'settings_delete_account',
};

export const LOG_LEVELS = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST'];

export const TITLES = {
  BAR_JETSTREAM: '| Jetstream',
  QUERY: 'Query | Jetstream',
  LOAD: 'Load | Jetstream',
  AUTOMATION_CONTROL: 'Automation Control | Jetstream',
  MANAGE_PERMISSIONS: 'Manage Permissions | Jetstream',
  DEPLOY_METADATA: 'Deploy Metadata | Jetstream',
  CREATE_OBJ_FIELD: 'Create Object & Fields | Jetstream',
  ANON_APEX: 'Anonymous Apex | Jetstream',
  DEBUG_LOGS: 'Debug Logs | Jetstream',
  API_EXPLORER: 'Salesforce Api | Jetstream',
  PLATFORM_EVENTS: 'Platform Events | Jetstream',
  FEEDBACK: 'Support & Feedback | Jetstream',
  SETTINGS: 'Account Settings | Jetstream',
};

export const SOCKET_EVENTS = {
  // PLATFORM EVENT
  PLATFORM_EVENT_MESSAGE: 'platform-event:message',
  PLATFORM_EVENT_SUBSCRIBE: 'platform-event:subscribe',
  PLATFORM_EVENT_UNSUBSCRIBE: 'platform-event:unsubscribe',
};
