import * as services from '@jetstream/server-services';
import fetch, { RequestInit } from 'node-fetch';
import { ensureArray, ensureBoolean, flattenObjectArray, splitArrayToMaxSize, toBoolean } from '@jetstream/shared/utils';
import { ControllerFn, ControllerFnDataParams, ControllerFnParams, ControllerFnQuery, ControllerFnQueryParams } from '../types';
import * as JSZip from 'jszip';
import {
  ApexCompletionResponse,
  BulkApiCreateJobRequestPayload,
  BulkApiDownloadType,
  GenericRequestPayload,
  ListMetadataResult,
  ManualRequestPayload,
  ManualRequestResponse,
  MapOf,
  Maybe,
} from '@jetstream/types';
import { correctInvalidXmlResponseTypes, getRetrieveRequestFromListMetadata } from '@jetstream/server-services';
import { Connection, DeployOptions, RequestInfo, RetrieveRequest, Tooling } from 'jsforce';
import { HTTP, MIME_TYPES, ORG_VERSION_PLACEHOLDER } from '@jetstream/shared/constants';
import { isObject, isString } from 'lodash';
import { ENV } from '../env';
import { parse as parseCsv } from 'papaparse';

const SESSION_ID_RGX = /\{sessionId\}/i;

function ensureConnection(connection: Maybe<Connection>): Connection {
  if (!connection) {
    throw new Error('Connection is required');
  }
  return connection;
}

export const handleGlobalDescribe: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const response = await ensureConnection(connection).describeGlobal();
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const handleDescribeSobject: ControllerFnParams<{ sobject: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const response = await ensureConnection(connection).describe(params.sobject);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const describeMetadata: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const response = await ensureConnection(connection).metadata.describe();
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const listMetadata: ControllerFn<{ types: { type: string; folder: string }[] }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const types: { type: string; folder?: string }[] =
      request.data?.types.map(({ type, folder }) => {
        if (folder) {
          return { type, folder };
        }
        return { type };
      }) || [];
    const response = services.correctInvalidArrayXmlResponseTypes(await ensureConnection(connection).metadata.list(types));
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const readMetadata: ControllerFnDataParams<{ fullNames: string[] }, { type: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const fullNames = request.data?.fullNames || [];
    const metadataType = params.type;

    const response = await (
      await Promise.all(
        splitArrayToMaxSize(fullNames, 10).map((fullNames) => ensureConnection(connection).metadata.read(metadataType, fullNames))
      )
    ).flat();
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const deployMetadata: ControllerFn<{ options: any; files: { fullFilename: string; content: string }[] }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const files: { fullFilename: string; content: string }[] = request.data?.files || [];

    const zip = new JSZip();
    files.forEach((file) => zip.file(file.fullFilename, file.content));

    // TODO: see if this works
    const results = await ensureConnection(connection).metadata.deploy(zip.generateNodeStream(), request.data?.options);

    resolve(results);
  } catch (ex) {
    reject(ex);
  }
};

export const deployMetadataZip: ControllerFn<ArrayBuffer, { options: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    if (!request.query || !request.data) {
      throw new Error('Invalid request');
    }
    const options = JSON.parse(request.query.options);
    // TODO: FE should transfer object instead of clone
    const metadataPackage = Buffer.from(request.data); // initial type is ArrayBuffer

    const response = await ensureConnection(connection).metadata.deploy(metadataPackage, options);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const checkMetadataResults: ControllerFnQueryParams<{ includeDetails: string }, { id: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    // JSForce has invalid types, and XML is poorly formatted
    const includeDetails = ensureBoolean(request.query?.includeDetails);
    let results = (await ensureConnection(connection).metadata.checkDeployStatus(params.id, includeDetails)) as any;

    try {
      if (results) {
        results = correctInvalidXmlResponseTypes(results);
      }
      if (results.details) {
        results.details.componentFailures = ensureArray(results.details.componentFailures).map((item) =>
          correctInvalidXmlResponseTypes(item)
        );
        results.details.componentSuccesses = ensureArray(results.details.componentSuccesses).map((item) =>
          correctInvalidXmlResponseTypes(item)
        );

        if (results.details.runTestResult) {
          results.details.runTestResult.numFailures = Number.parseInt(results.details.runTestResult.numFailures);
          results.details.runTestResult.numTestsRun = Number.parseInt(results.details.runTestResult.numFailures);
          results.details.runTestResult.totalTime = Number.parseFloat(results.details.runTestResult.numFailures);

          results.details.runTestResult.codeCoverage = ensureArray(results.details.runTestResult.codeCoverage).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
          results.details.runTestResult.codeCoverageWarnings = ensureArray(results.details.runTestResult.codeCoverageWarnings).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
          results.details.runTestResult.failures = ensureArray(results.details.runTestResult.failures).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
          results.details.runTestResult.flowCoverage = ensureArray(results.details.runTestResult.flowCoverage).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
          results.details.runTestResult.flowCoverageWarnings = ensureArray(results.details.runTestResult.flowCoverageWarnings).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
          results.details.runTestResult.successes = ensureArray(results.details.runTestResult.successes).map((item) =>
            correctInvalidXmlResponseTypes(item)
          );
        }
      }
    } catch (ex) {
      console.warn('Error converting checkDeployStatus results');
    }
    resolve(results);
  } catch (ex) {
    reject(ex);
  }
};

export const retrievePackageFromLisMetadataResults: ControllerFn<MapOf<ListMetadataResult[]>> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const types = request.data || {};
    const response = await ensureConnection(connection).metadata.retrieve(
      getRetrieveRequestFromListMetadata(types, ensureConnection(connection).version)
    );
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const retrievePackageFromExistingServerPackages: ControllerFn<{ packageNames: string[] }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const packageNames = request.data.packageNames;

    const retrieveRequest: RetrieveRequest = {
      apiVersion: ensureConnection(connection).version,
      packageNames,
      singlePackage: false,
    };

    const response = correctInvalidXmlResponseTypes(await ensureConnection(connection).metadata.retrieve(retrieveRequest));

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const retrievePackageFromManifest: ControllerFn<{ packageManifest: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const packageManifest = request.data.packageManifest;
    const response = correctInvalidXmlResponseTypes(
      await ensureConnection(connection).metadata.retrieve(services.getRetrieveRequestFromManifest(packageManifest))
    );
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const checkRetrieveStatus: ControllerFnQuery<{ id: string }> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    if (!request.query?.id) {
      throw new Error('Invalid request');
    }
    const id = request.query.id;
    const response = await ensureConnection(connection).metadata.checkRetrieveStatus(id);
    response.fileProperties = ensureArray(response.fileProperties);
    response.messages = ensureArray(response.messages);

    resolve(correctInvalidXmlResponseTypes(response));
  } catch (ex) {
    reject(ex);
  }
};

export const checkRetrieveStatusAndRedeploy: ControllerFn<
  {
    deployOptions: DeployOptions;
    replacementPackageXml: string;
    changesetName: string;
  },
  { id: string }
> = async (_, __, params, { reject, resolve, connection, targetConnection, request }) => {
  try {
    if (!request.query?.id || !request.data) {
      throw new Error('Invalid request');
    }
    const id = request.query.id;
    const deployOptions = request.data.deployOptions;
    const replacementPackageXml = request.data.replacementPackageXml;
    const changesetName = request.data.changesetName;

    const response = services.checkRetrieveStatusAndRedeploy(ensureConnection(connection), {
      id,
      deployOptions,
      replacementPackageXml,
      changesetName,
      targetConn: ensureConnection(targetConnection),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fallbackApiVersion: ENV.sfdcFallbackApiVersion!,
    });

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const getPackageXml: ControllerFn<{ types: MapOf<ListMetadataResult[]>; otherFields: MapOf<string> }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const types = request.data.types;
    const otherFields = request.data.otherFields;

    resolve(services.buildPackageXml(types, ensureConnection(connection).version, otherFields));
  } catch (ex) {
    reject(ex);
  }
};

export const executeAnonymousApex: ControllerFn<{ apex: string; logLevel?: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const apex = request.data.apex;
    const logLevel = request.data.logLevel;

    const response = services.executeAnonymousApex(ensureConnection(connection), { apex, logLevel });

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const apexCompletions: ControllerFnParams<{ type: string }> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const type = params.type;

    const requestOptions: RequestInfo = {
      method: 'GET',
      url: `${ensureConnection(connection).instanceUrl}/services/data/v${
        ensureConnection(connection).version
      }/tooling/completions?type=${type}`,
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: MIME_TYPES.JSON,
        [HTTP.HEADERS.ACCEPT]: MIME_TYPES.JSON,
      },
    };

    const response = await ensureConnection(connection).request<ApexCompletionResponse>(requestOptions);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const createJob: ControllerFn<BulkApiCreateJobRequestPayload> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const options = request.data;
    const response = services.sfBulkCreateJob(ensureConnection(connection), options);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const getJob: ControllerFnParams<{ jobId: string }> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const jobId = params.jobId;

    const response = services.sfBulkGetJobInfo(ensureConnection(connection), jobId);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const closeJob: ControllerFnParams<{ jobId: string }> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const jobId = params.jobId;

    const response = services.sfBulkCloseJob(ensureConnection(connection), jobId);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

// TODO: make sure csv is not converted to JSON
export const addBatchToJob: ControllerFn<string, { closeJob?: string }, { jobId: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const jobId = params.jobId;
    const csv = request.data;
    const closeJob = ensureBoolean(request.query?.closeJob);
    if (!csv) {
      throw new Error('Invalid request');
    }

    const response = services.sfBulkAddBatchToJob(ensureConnection(connection), csv, jobId, closeJob);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

// TODO: make sure csv is not converted to JSON
export const addBatchToJobWithBinaryAttachment: ControllerFn<Buffer | ArrayBuffer, { closeJob?: string }, { jobId: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const jobId = params.jobId;
    const zip = request.data;
    const closeJob = ensureBoolean(request.query?.closeJob);

    if (!zip) {
      throw new Error('Invalid request');
    }

    const response = services.sfBulkAddBatchWithZipAttachmentToJob(ensureConnection(connection), zip, jobId, closeJob);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const downloadBulkApiResults: ControllerFnQueryParams<{ type: string }, { jobId: string; batchId: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const jobId = params.jobId;
    const batchId = params.batchId;
    const type = request.query?.type;

    const requestOptions: RequestInfo = {
      method: `get`,
      url: `${ensureConnection(connection).instanceUrl}/services/async/${
        ensureConnection(connection).version
      }/job/${jobId}/batch/${batchId}/${type}`,
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.XML_UTF8,
        Accept: HTTP.CONTENT_TYPE.CSV,
        [HTTP.HEADERS.X_SFDC_Session]: ensureConnection(connection).accessToken,
      },
    };

    const csvResults = await ensureConnection(connection).request<string>(requestOptions, { responseType: 'text' });

    const { data: response } = parseCsv(csvResults, {
      delimiter: ',',
      header: true,
      skipEmptyLines: true,
      transform: (data, field) => {
        if (field === 'Success' || field === 'Created') {
          return toBoolean(data);
        } else if (field === 'Id' || field === 'Error') {
          return data || null;
        }
        return data;
      },
    });

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const makeJsforceRequest: ControllerFn<GenericRequestPayload> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const { url, method, isTooling, body, headers, options } = request.data || {};
    const conn: Connection | Tooling = isTooling ? ensureConnection(connection).tooling : ensureConnection(connection);

    const requestOptions: RequestInfo = {
      method,
      url,
      body: isObject(body) ? JSON.stringify(body) : body,
      headers:
        (isObject(headers) || isObject(body)) && !headers?.['Content-Type']
          ? { ...headers, ['Content-Type']: 'application/json' }
          : headers,
    };

    const response = await conn.request(requestOptions, options);

    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const makeJsforceRequestViaNode: ControllerFn<ManualRequestPayload> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const { method, headers } = request.data || {};
    let { url, body } = request.data || {};

    url = url?.replace(ORG_VERSION_PLACEHOLDER, ensureConnection(connection).version);

    const config: RequestInit = {
      method,
      // X-SFDC-Session is used for some SOAP APIs, such as the bulk api
      headers: {
        ...(headers || {}),
        ['Authorization']: `Bearer ${ensureConnection(connection).accessToken}`,
        ['X-SFDC-Session']: ensureConnection(connection).accessToken,
      },
    };

    if (isString(body) && SESSION_ID_RGX.test(body)) {
      body = body.replace(SESSION_ID_RGX, ensureConnection(connection).accessToken);
    }

    if (method !== 'GET' && body) {
      config.body = isString(body) ? body : JSON.stringify(body);
    }

    fetch(`${ensureConnection(connection).instanceUrl}/${url}`.replaceAll('//', '/'), config)
      .then(async (response) => {
        resolve({
          error: response.status < 200 || response.status > 300,
          status: response.status,
          statusText: response.statusText,
          headers: JSON.stringify(flattenObjectArray(response.headers.raw()), null, 2),
          body: await response.text(),
        });
      })
      .catch((error) => {
        resolve({
          error: true,
          errorMessage: error.message || 'An unknown error has occurred, the request was not made.',
          status: null,
          statusText: null,
          headers: null,
          body: null,
        });
      });
  } catch (ex) {
    reject(ex);
  }
};

export const query: ControllerFn<{ query: string }, { isTooling?: string; includeDeletedRecords?: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const { query } = request.data || {};
    request.query = request.query || {};
    if (!query) {
      throw new Error('Invalid request');
    }
    const isTooling = ensureBoolean(request.query.isTooling);
    const includeDeletedRecords = ensureBoolean(request.query.includeDeletedRecords);
    const response = await services.queryRecords(ensureConnection(connection), query, isTooling, includeDeletedRecords);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const queryMore: ControllerFnQuery<{ nextRecordsUrl?: string; isTooling?: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    request.query = request.query || {};
    const isTooling = ensureBoolean(request.query.isTooling);
    const nextRecordsUrl = request.query.nextRecordsUrl;
    if (!nextRecordsUrl) {
      throw new Error('nextRecordsUrl is required');
    }
    const response = await services.queryMoreRecords(ensureConnection(connection), nextRecordsUrl, isTooling);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const recordOperation: ControllerFn<
  { ids?: string[]; records?: any },
  { externalId?: string; allOrNone?: string },
  { sobject: string; operation: string }
> = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    if (!request.data) {
      throw new Error('Invalid request');
    }
    const response = await services.recordOperation(ensureConnection(connection), {
      sobject: params.sobject,
      operation: params.operation,
      ids: request.data.ids,
      records: request.data.records,
      externalId: request.query?.externalId,
      allOrNone: request.query?.allOrNone,
    });
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

// recordOperation
