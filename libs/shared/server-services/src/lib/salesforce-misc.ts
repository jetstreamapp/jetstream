import { HTTP, MIME_TYPES } from '@jetstream/shared/constants';
import { ensureArray, getValueOrSoapNull, orderObjectsBy, sanitizeForXml, toBoolean } from '@jetstream/shared/utils';
import { AnonymousApexResponse, AnonymousApexSoapResponse, ListMetadataResult, MapOf } from '@jetstream/types';
import * as jsforce from 'jsforce';
import { DeployOptions, PackageTypeMembers, RetrieveRequest } from 'jsforce';
import JSZip from 'jszip';
import { isObject, isObjectLike, isString, get as lodashGet, toNumber } from 'lodash';
import { create as xmlBuilder } from 'xmlbuilder2';
import { UserFacingError } from './errors';

export async function getFrontdoorLoginUrl(conn: jsforce.Connection, returnUrl?: string) {
  // ensure that our token is valid and not expired
  await conn.identity();
  let url = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}`;
  if (returnUrl) {
    url += `&retURL=${returnUrl}`;
  }
  return url;
}

export function correctInvalidArrayXmlResponseTypes<T = any>(item: T[]): T[] {
  if (!Array.isArray(item)) {
    if (item) {
      item = [item] as any;
    } else {
      return []; // null response
    }
  }
  return item.map(correctInvalidXmlResponseTypes);
}

export function correctInvalidXmlResponseTypes<T = any>(item: T): T {
  // TODO: what about number types?
  Object.keys(item as any).forEach((key) => {
    if (isString(item[key]) && (item[key] === 'true' || item[key] === 'false')) {
      item[key] = item[key] === 'true';
    } else if (!Array.isArray(item[key]) && isObject(item[key]) && item[key]['$']) {
      // {$: {"xsi:nil": true}}
      item[key] = null;
    }
  });
  return item;
}

export async function recordOperation(
  conn: jsforce.Connection,
  data: {
    sobject: string;
    operation: string;
    ids?: string[];
    records?: any;
    externalId?: string;
    allOrNone?: string;
  }
) {
  const { sobject, operation, ids, records, externalId } = data;

  const allOrNone = toBoolean(data.allOrNone, true);
  // TODO: validate combination based on operation or add validation to case statement

  const sobjectOperation = conn.sobject(sobject);

  // FIXME: submit PR to fix these types - allOrNone / allowRecursive
  const options: any = { allOrNone };

  let operationPromise: Promise<unknown>;

  switch (operation) {
    case 'retrieve':
      if (!ids) {
        return new UserFacingError(`The ids property must be included`);
      }
      operationPromise = sobjectOperation.retrieve(ids, options);
      break;
    case 'create':
      if (!records) {
        return new UserFacingError(`The records property must be included`);
      }
      operationPromise = sobjectOperation.create(records, options);
      break;
    case 'update':
      if (!records) {
        return new UserFacingError(`The records property must be included`);
      }
      operationPromise = sobjectOperation.update(records, options);
      break;
    case 'upsert':
      if (!records || !externalId) {
        return new UserFacingError(`The records and external id properties must be included`);
      }
      operationPromise = sobjectOperation.upsert(records, externalId as string, options);
      break;
    case 'delete':
      if (!ids) {
        return new UserFacingError(`The ids property must be included`);
      }
      operationPromise = sobjectOperation.delete(ids, options);
      break;
    default:
      return new UserFacingError(`The operation ${operation} is not valid`);
  }

  return await operationPromise;
}

const VALID_PACKAGE_VERSION = /^[0-9]+\.[0-9]+$/;

export function buildPackageXml(types: MapOf<ListMetadataResult[]>, version: string, otherFields: MapOf<string> = {}, prettyPrint = true) {
  // prettier-ignore
  const packageNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
    .ele('Package', { xmlns: 'http://soap.sforce.com/2006/04/metadata' });

  Object.keys(types).forEach((metadataType) => {
    const typesNode = packageNode.ele('types');
    if (types[metadataType].length) {
      orderObjectsBy(types[metadataType], 'fullName').forEach(({ fullName }) => {
        typesNode.ele('members').txt(fullName);
      });
      typesNode.ele('name').txt(metadataType);
    }
  });

  if (otherFields) {
    Object.keys(otherFields).forEach((key) => {
      packageNode.ele(key).txt(otherFields[key]);
    });
  }

  packageNode.ele('version').txt(version);

  return packageNode.end({ prettyPrint });
}

export function getRetrieveRequestFromListMetadata(types: MapOf<ListMetadataResult[]>, version: string) {
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve_request.htm
  const retrieveRequest: RetrieveRequest = {
    apiVersion: version,
    singlePackage: true,
    unpackaged: {
      types: Object.keys(types).map((metadataName) => {
        const members = types[metadataName];
        return {
          members: members.map(({ fullName }) => fullName),
          name: metadataName,
        };
      }),
      version: version,
    },
  };
  return retrieveRequest;
}

/**
 * TODO: should we handle other packages fields?
 *
 * @param packageManifest
 */
export function getRetrieveRequestFromManifest(packageManifest: string) {
  let manifestXml;
  try {
    manifestXml = xmlBuilder(packageManifest).toObject({ wellFormed: true }) as any;
  } catch (ex) {
    throw new UserFacingError('The package manifest format is invalid');
  }
  // validate parsed package manifest
  if (!manifestXml || Array.isArray(manifestXml)) {
    throw new UserFacingError('The package manifest format is invalid');
  } else {
    const version: string = lodashGet(manifestXml, 'Package.version');
    let types: PackageTypeMembers[] = lodashGet(manifestXml, 'Package.types');
    if (isObjectLike(types)) {
      types = ensureArray(types);
    }
    if (!isString(version) || !VALID_PACKAGE_VERSION.test(version)) {
      throw new UserFacingError('The package manifest version is invalid or is missing');
    } else if (!Array.isArray(types) || !types.length) {
      throw new UserFacingError('The package manifest is missing types');
    }

    const retrieveRequest: RetrieveRequest = {
      apiVersion: version,
      unpackaged: {
        types,
        version: version,
      },
    };
    return retrieveRequest;
  }
}

export async function checkRetrieveStatusAndRedeploy(
  conn: jsforce.Connection,
  {
    id,
    deployOptions,
    replacementPackageXml,
    changesetName,
    targetConn,
    fallbackApiVersion,
  }: {
    id: string;
    deployOptions?: DeployOptions;
    replacementPackageXml?: string;
    changesetName?: string;
    targetConn: jsforce.Connection;
    fallbackApiVersion: string;
  }
) {
  const results = correctInvalidXmlResponseTypes(await conn.metadata.checkRetrieveStatus(id));

  if (isString(results.zipFile)) {
    const oldPackage = await JSZip.loadAsync(results.zipFile, { base64: true });
    // create a new zip in the correct structure to add to changeset
    if (replacementPackageXml && changesetName) {
      const newPackage = JSZip();
      newPackage
        .folder('unpackaged')
        ?.file(
          'package.xml',
          `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n\t<version>${
            conn.version || fallbackApiVersion
          }</version>\n</Package>`
        );

      oldPackage.forEach((relativePath, file) => {
        if (file.name === 'package.xml') {
          newPackage.folder(changesetName)?.file(relativePath, replacementPackageXml);
        } else if (!file.dir) {
          newPackage.folder(changesetName)?.file(relativePath, file.async('uint8array'), { binary: true });
        }
      });
      const deployResults = await targetConn.metadata.deploy(
        await newPackage.generateAsync({ type: 'base64', compression: 'STORE', mimeType: 'application/zip', platform: 'UNIX' }),
        deployOptions || {}
      );
      return { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults), zipFile: results.zipFile };
    } else {
      // Deploy package as-is
      const deployResults = await targetConn.metadata.deploy(oldPackage.generateNodeStream() as any, deployOptions || {});
      return { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults), zipFile: results.zipFile };
    }
  } else {
    return { type: 'retrieve', results };
  }
}

export async function executeAnonymousApex(conn: jsforce.Connection, { apex, logLevel }: { apex: string; logLevel?: string }) {
  logLevel = logLevel || 'FINEST';
  const requestOptions: jsforce.RequestInfo = {
    method: 'POST',
    url: `${conn.instanceUrl}/services/Soap/s/${conn.version}`,
    headers: {
      [HTTP.HEADERS.CONTENT_TYPE]: MIME_TYPES.XML,
      [HTTP.HEADERS.ACCEPT]: MIME_TYPES.XML,
      SOAPAction: '""',
    },
    body: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:apex="http://soap.sforce.com/2006/08/apex">
<soapenv:Header>
  <apex:CallOptions>
    <apex:client>jetstream</apex:client>
  </apex:CallOptions>
  <apex:DebuggingHeader>
    <apex:categories>
      <apex:category>Db</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Workflow</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Validation</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Callout</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Apex_code</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Apex_profiling</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>Visualforce</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>System</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
    <apex:categories>
      <apex:category>All</apex:category>
      <apex:level>${logLevel}</apex:level>
    </apex:categories>
  </apex:DebuggingHeader>
  <apex:SessionHeader>
    <apex:sessionId>${conn.accessToken}</apex:sessionId>
  </apex:SessionHeader>
</soapenv:Header>
<soapenv:Body>
  <apex:executeAnonymous>
    <apex:String>${sanitizeForXml(apex)}</apex:String>
  </apex:executeAnonymous>
</soapenv:Body>
</soapenv:Envelope>`,
  };

  const soapResponse = await conn.request<AnonymousApexSoapResponse>(requestOptions, { responseType: 'text/xml' });
  const header = soapResponse['soapenv:Envelope']['soapenv:Header'];
  const body = soapResponse?.['soapenv:Envelope']?.['soapenv:Body']?.executeAnonymousResponse?.result;
  const results: AnonymousApexResponse = {
    debugLog: header?.DebuggingInfo?.debugLog || '',
    result: {
      column: toNumber(getValueOrSoapNull(body.column) || -1),
      compileProblem: getValueOrSoapNull(body.compileProblem) || null,
      compiled: toBoolean(getValueOrSoapNull(body.compiled)) || false,
      exceptionMessage: getValueOrSoapNull(body.exceptionMessage) || null,
      exceptionStackTrace: getValueOrSoapNull(body.exceptionStackTrace) || null,
      line: toNumber(getValueOrSoapNull(body.line)) || -1,
      success: toBoolean(getValueOrSoapNull(body.success)) || false,
    },
  };

  return results;
}
