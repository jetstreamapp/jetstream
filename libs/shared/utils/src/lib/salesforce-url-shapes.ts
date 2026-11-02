/**
 * Shape checks for the Salesforce REST paths that callers hand back to us and that we then request
 * with the org's credentials. Each proxy pins the request to the org's origin, but the path itself
 * decides which Salesforce resource runs, so these keep caller-supplied paths to the exact resource
 * types the feature exists for.
 */

/**
 * The `nextRecordsUrl` Salesforce returns when a query has more rows:
 * `/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000`. `queryAll` and Tooling queries use the same
 * shape under `queryAll/` and `tooling/query/`. The locator is an opaque alphanumeric token followed by
 * the record offset.
 */
const QUERY_LOCATOR_URL_REGEX = /^\/services\/data\/v\d+\.\d+\/(?:tooling\/)?query(?:All)?\/[A-Za-z0-9]{15,40}-\d{1,10}$/;

/**
 * A record blob field: `/services/data/v62.0/sobjects/ContentVersion/068.../VersionData`,
 * `/services/data/v62.0/sobjects/Attachment/00P.../Body`, `/services/data/v62.0/tooling/sobjects/ApexLog/07L.../Body`.
 */
const SOBJECT_BLOB_FIELD_URL_REGEX =
  /^\/services\/data\/v\d+\.\d+\/(?:tooling\/)?sobjects\/[A-Za-z][A-Za-z0-9_]*\/[A-Za-z0-9]{15,18}\/[A-Za-z][A-Za-z0-9_]*$/;

export function isQueryLocatorUrl(value: unknown): value is string {
  return typeof value === 'string' && QUERY_LOCATOR_URL_REGEX.test(value);
}

export function isSObjectBlobFieldUrl(value: unknown): value is string {
  return typeof value === 'string' && SOBJECT_BLOB_FIELD_URL_REGEX.test(value);
}
