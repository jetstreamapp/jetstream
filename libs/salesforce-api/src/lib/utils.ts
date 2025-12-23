/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTP } from '@jetstream/shared/constants';
import { ensureArray, ensureBoolean, fileExtensionFromMimeType, splitFilenameByExtension, unSanitizeXml } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, DeployResult, FileNameFormat, Maybe, RecordResult, SalesforceRecord } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import isEmpty from 'lodash/isEmpty';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { ApiRequestOptions } from './types';

type SOAP_TYPE = 'APEX' | 'METADATA' | 'PARTNER';

interface SoapRequestOptions {
  type: SOAP_TYPE;
  body: Record<string, any>;
  header?: Record<string, unknown>;
}

export class SalesforceApi {
  private connection: ApiConnection;

  get apiRequest() {
    return this.connection.apiRequest;
  }

  get apiVersion() {
    return this.sessionInfo.apiVersion;
  }

  get instanceUrl() {
    return this.sessionInfo.instanceUrl;
  }

  get sessionInfo() {
    return this.connection.sessionInfo;
  }

  get logger() {
    return this.connection.logger;
  }

  constructor(connection: ApiConnection) {
    this.connection = connection;
  }

  prepareSoapRequestOptions(options: SoapRequestOptions): ApiRequestOptions {
    const { type } = options;
    return {
      sessionInfo: this.sessionInfo,
      url: `${SoapPrefixMap[type]}/${this.apiVersion}`,
      method: 'POST',
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.XML_TEXT, Accept: HTTP.CONTENT_TYPE.XML, SOAPAction: '""' },
      body: this.createSoapEnvelope(options),
      outputType: 'soap',
    };
  }

  /**
   * Construct REST API URL
   * /services/data/v00.0 + pathSuffix
   *
   * @param pathSuffix should start with a slash
   */
  getRestApiUrl(pathSuffix = '', isTooling: Maybe<boolean> = false) {
    let url = `/services/data/v${this.apiVersion}`;
    if (isTooling) {
      url += '/tooling';
    }
    url += pathSuffix;
    return url;
  }

  getBulkApiUrl(pathSuffix = '') {
    return `/services/async/${this.apiVersion}${pathSuffix}`;
  }

  createSoapEnvelope({ body, header, type }: SoapRequestOptions) {
    const { accessToken, callOptions } = this.sessionInfo;
    const namespacePrefix = SoapTagPrefixMap[type] ? `${SoapTagPrefixMap[type]}:` : '';
    const xmlHeader = header ? toSoapXML(header, undefined, SoapTagPrefixMap[type]) : '';
    const callOptionsXml = callOptions
      ? `<${namespacePrefix}CallOptions>${Object.entries(callOptions)
          .map(([attribute, value]) => `<${attribute}>${value}</${attribute}>`)
          .join('')}</${namespacePrefix}CallOptions>`
      : '';

    const envelopeAttributes = Object.entries({
      'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
      'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xmlns:urn': SoapNamespacePrefixMap[type] || '',
      xmlns: SoapNamespaceMap[type] || '',
    })
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<soapenv:Envelope ${envelopeAttributes}>`,
      `<soapenv:Header>`,
      `<${namespacePrefix}SessionHeader><${namespacePrefix}sessionId>${accessToken}</${namespacePrefix}sessionId></${namespacePrefix}SessionHeader>`,
      callOptionsXml,
      xmlHeader,
      '</soapenv:Header>',
      `<soapenv:Body>`,
      toSoapXML(body, undefined, SoapTagPrefixMap[type]),
      '</soapenv:Body>',
      '</soapenv:Envelope>',
    ]
      .filter(Boolean)
      .join('');
  }
}

export const SoapNamespaceMap: Record<SOAP_TYPE, string | undefined> = {
  METADATA: 'http://soap.sforce.com/2006/04/metadata',
  APEX: 'http://soap.sforce.com/2006/08/apex',
  PARTNER: undefined,
} as const;

export const SoapNamespacePrefixMap: Record<SOAP_TYPE, string | undefined> = {
  METADATA: undefined,
  APEX: undefined,
  PARTNER: 'urn:partner.soap.sforce.com',
} as const;

export const SoapTagPrefixMap: Record<SOAP_TYPE, string | undefined> = {
  METADATA: undefined,
  APEX: undefined,
  PARTNER: 'urn',
} as const;

export const SoapPrefixMap: Record<SOAP_TYPE, string> = {
  METADATA: '/services/Soap/m',
  APEX: '/services/Soap/s',
  PARTNER: '/services/Soap/u',
} as const;

export function toSoapXML(name: unknown, value?: unknown, namespacePrefix?: string): string {
  if (isObject(name)) {
    value = name;
    name = null;
  }
  if (Array.isArray(value)) {
    return value.map((v) => toSoapXML(name, v, namespacePrefix)).join('');
  }

  if (value === null || value === undefined) {
    return '';
  }

  const attrs: string[] = [];
  const elems: string[] = [];
  if (isObject(value)) {
    for (let k in value) {
      const v = (value as any)[k];
      if (k[0] === '@') {
        k = k.substring(1);
        attrs.push(`${k}="${v}"`);
      } else {
        elems.push(toSoapXML(k, v, namespacePrefix));
      }
    }
    value = elems.join('');
  } else {
    value = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  const tagName = name && namespacePrefix ? `${namespacePrefix}:${name}` : name;
  const attributes = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const startTag = tagName ? `<${tagName}${attributes}>` : '';
  const endTag = tagName ? `</${tagName}>` : '';
  return `${startTag}${value}${endTag}`;
}

export function correctDeployMetadataResultTypes(results: DeployResult) {
  try {
    if (results) {
      results = correctInvalidXmlResponseTypes(results);
      results.numberComponentErrors = Number(results.numberComponentErrors);
      results.numberComponentsDeployed = Number(results.numberComponentsDeployed);
      results.numberComponentsTotal = Number(results.numberComponentsTotal);
      results.numberTestErrors = Number(results.numberTestErrors);
      results.numberTestsCompleted = Number(results.numberTestsCompleted);
      results.numberTestsTotal = Number(results.numberTestsTotal);
    }
    if (results.details) {
      results.details.componentFailures = ensureArray(results.details.componentFailures).map((item) =>
        correctInvalidXmlResponseTypes(item),
      );
      results.details.componentSuccesses = ensureArray(results.details.componentSuccesses).map((item) =>
        correctInvalidXmlResponseTypes(item),
      );

      if (results.details.runTestResult) {
        results.details.runTestResult.numFailures = Number.parseInt(results.details.runTestResult.numFailures as any);
        results.details.runTestResult.numTestsRun = Number.parseInt(results.details.runTestResult.numFailures as any);
        results.details.runTestResult.totalTime = Number.parseFloat(results.details.runTestResult.numFailures as any);

        results.details.runTestResult.codeCoverage = ensureArray(results.details.runTestResult.codeCoverage).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
        results.details.runTestResult.codeCoverageWarnings = ensureArray(results.details.runTestResult.codeCoverageWarnings).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
        results.details.runTestResult.failures = ensureArray(results.details.runTestResult.failures).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
        results.details.runTestResult.flowCoverage = ensureArray(results.details.runTestResult.flowCoverage).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
        results.details.runTestResult.flowCoverageWarnings = ensureArray(results.details.runTestResult.flowCoverageWarnings).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
        results.details.runTestResult.successes = ensureArray(results.details.runTestResult.successes).map((item) =>
          correctInvalidXmlResponseTypes(item),
        );
      }
    }
    return results;
  } catch {
    // just return as-is
    return results;
  }
}

export function correctRecordResultSoapXmlResponse(results: RecordResult | RecordResult[]): RecordResult[] {
  return ensureArray(results).map((row: RecordResult) => ({
    ...row,
    errors: (row.success as any) === 'true' ? undefined : ensureArray((row as any).errors),
    success: ensureBoolean(row.success),
  })) as RecordResult[];
}

export function correctInvalidArrayXmlResponseTypes<T = any>(item: T[] | T): T[] {
  if (!Array.isArray(item)) {
    if (!item || (isObject(item) && item?.['@xsi:nil'] === 'true')) {
      return []; // null response
    }
    item = [item] as any;
  }
  return (item as T[]).map(correctInvalidXmlResponseTypes);
}

export function correctInvalidXmlResponseTypes<T = any>(item: T): T {
  if (isObject(item) && (item?.['@xsi:nil'] === 'true' || isEmpty(item))) {
    return null as any;
  }
  // TODO: what about number types?
  Object.keys(item as any).forEach((key: string) => {
    if (
      !Array.isArray((item as any)[key]) &&
      isObject((item as any)[key]) &&
      ((item as any)[key]?.['@xsi:nil'] === 'true' || isEmpty((item as any)[key]))
    ) {
      (item as any)[key] = null;
    } else if (isString((item as any)[key]) && ((item as any)[key] === 'true' || (item as any)[key] === 'false')) {
      (item as any)[key] = (item as any)[key] === 'true';
    } else if (isString((item as any)[key])) {
      (item as any)[key] = unSanitizeXml((item as any)[key]);
    } else if (!Array.isArray((item as any)[key]) && isObject((item as any)[key]) && (item as any)[key]['$']) {
      // {$: {"xsi:nil": true}}
      (item as any)[key] = null;
    }
  });
  return item;
}

export function prepareBulkApiRequestPayload({
  type,
  sObject,
  assignmentRuleId,
  serialMode,
  externalId,
  hasZipAttachment,
}: BulkApiCreateJobRequestPayload) {
  const externalIdFieldName = type === 'UPSERT' && externalId ? `<externalIdFieldName>${externalId}</externalIdFieldName>` : '';
  const concurrencyMode = `<concurrencyMode>${serialMode ? 'Serial' : 'Parallel'}</concurrencyMode>`;
  const contentType = `<contentType>${hasZipAttachment ? 'ZIP_CSV' : 'CSV'}</contentType>`;
  const assignmentRule = isString(assignmentRuleId) && assignmentRuleId ? `<assignmentRuleId>${assignmentRuleId}</assignmentRuleId>` : '';

  let operation = type.toLowerCase();
  if (operation === 'query_all') {
    operation = 'queryAll';
  } else if (operation === 'hard_delete') {
    operation = 'hardDelete';
  }

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">`,
    `<operation>${operation}</operation>`,
    `<object>${sObject}</object>`,
    externalIdFieldName,
    concurrencyMode,
    contentType,
    assignmentRule,
    `</jobInfo>`,
  ]
    .filter(Boolean)
    .join('\n');

  return xml;
}

export function prepareCloseOrAbortJobPayload(state: 'Closed' | 'Aborted' = 'Closed') {
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">`,
    `<state>${state}</state>`,
    `</jobInfo>`,
  ]
    .filter(Boolean)
    .join('\n');

  return xml;
}

export function getBinaryFileRecordQueryMap(fileNameFormat: FileNameFormat) {
  function getFileNameAndExtension(record: SalesforceRecord, recordId: string, nameField: string, fileExtension?: Maybe<string>) {
    fileExtension = fileExtension ?? splitFilenameByExtension(record[nameField])[1];
    switch (fileNameFormat) {
      case 'name': {
        return { fileName: record[nameField], fileExtension };
      }
      case 'id': {
        return { fileName: recordId, fileExtension };
      }
      case 'nameAndId': {
        return { fileName: `${record[nameField]}-${recordId}`, fileExtension };
      }
      default:
        return { fileName: record[nameField], fileExtension };
    }
  }

  return {
    attachment: {
      getQuery: (recordIds: string[]) =>
        composeQuery({
          fields: [getField('Id'), getField('Name'), getField('Body'), getField('BodyLength'), getField('ContentType')],
          sObject: 'Attachment',
          where: {
            left: { field: 'Id', operator: 'IN', value: recordIds, literalType: 'STRING' },
          },
        }),
      transformToBinaryFileDownload: (records: { Id: string; Name: string; Body: string; BodyLength: number; ContentType: string }[]) =>
        records.map((record) => ({
          id: record.Id,
          url: record.Body,
          size: record.BodyLength,
          ...getFileNameAndExtension(record, record.Id, 'Name', fileExtensionFromMimeType(record.ContentType)),
        })),
    },
    document: {
      getQuery: (recordIds: string[]) =>
        composeQuery({
          fields: [getField('Id'), getField('Name'), getField('Body'), getField('BodyLength'), getField('Type')],
          sObject: 'Document',
          where: {
            left: { field: 'Id', operator: 'IN', value: recordIds, literalType: 'STRING' },
          },
        }),
      transformToBinaryFileDownload: (records: { Id: string; Name: string; Body: string; BodyLength: number; Type: string }[]) =>
        records.map((record) => ({
          id: record.Id,
          url: record.Body,
          size: record.BodyLength,
          ...getFileNameAndExtension(record, record.Id, 'Name', record.Type),
        })),
    },
    staticresource: {
      getQuery: (recordIds: string[]) =>
        composeQuery({
          fields: [getField('Id'), getField('Name'), getField('Body'), getField('BodyLength'), getField('ContentType')],
          sObject: 'StaticResource',
          where: {
            left: { field: 'Id', operator: 'IN', value: recordIds, literalType: 'STRING' },
          },
        }),
      transformToBinaryFileDownload: (records: { Id: string; Name: string; Body: string; BodyLength: number; ContentType: string }[]) =>
        records.map((record) => ({
          id: record.Id,
          url: record.Body,
          size: record.BodyLength,
          ...getFileNameAndExtension(record, record.Id, 'Name', fileExtensionFromMimeType(record.ContentType)),
        })),
    },
    contentversion: {
      getQuery: (recordIds: string[]) =>
        composeQuery({
          fields: [
            getField('Id'),
            getField('PathOnClient'),
            getField('Title'),
            getField('FileExtension'),
            getField('VersionData'),
            getField('ContentSize'),
          ],
          sObject: 'ContentVersion',
          where: {
            left: { field: 'Id', operator: 'IN', value: recordIds, literalType: 'STRING' },
          },
        }),
      transformToBinaryFileDownload: (
        records: {
          Id: string;
          PathOnClient: string;
          Title: string;
          FileExtension: string;
          VersionData: string;
          ContentSize: number;
        }[],
      ) =>
        records.map((record) => ({
          id: record.Id,
          url: record.VersionData,
          size: record.ContentSize,
          ...getFileNameAndExtension(record, record.Id, 'Title', record.FileExtension),
        })),
    },
  } as const;
}
