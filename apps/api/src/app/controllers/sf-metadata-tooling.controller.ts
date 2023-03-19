import { ENV, logger } from '@jetstream/api-config';
import { HTTP, LOG_LEVELS, MIME_TYPES } from '@jetstream/shared/constants';
import { ensureArray, getValueOrSoapNull, sanitizeForXml, splitArrayToMaxSize, toBoolean } from '@jetstream/shared/utils';
import { AnonymousApexResponse, AnonymousApexSoapResponse, ApexCompletionResponse, ListMetadataResult, MapOf } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as jsforce from 'jsforce';
import type { DeployOptions, RetrieveRequest } from 'jsforce';
import * as JSZip from 'jszip';
import { isObject, isString, toNumber } from 'lodash';
import { buildPackageXml, getRetrieveRequestFromListMetadata, getRetrieveRequestFromManifest } from '../services/sf-misc';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  listMetadata: [body('types').isArray().isLength({ min: 1 })],
  readMetadata: [body('fullNames').isArray().isLength({ min: 1 })],
  deployMetadata: [body('files').isArray().isLength({ min: 1 })],
  deployMetadataZip: [body().exists({ checkNull: true }), query('options').isJSON()],
  checkMetadataResults: [param('id').isLength({ min: 15, max: 18 }), query('includeDetails').toBoolean()],
  retrievePackageFromLisMetadataResults: [body().notEmpty(), body().not().isString(), body().not().isArray()],
  retrievePackageFromExistingServerPackages: [body('packageNames').isArray().isLength({ min: 1 })],
  retrievePackageFromManifest: [body('packageManifest').isString()],
  checkRetrieveStatus: [param('id').isLength({ min: 15, max: 18 })],
  checkRetrieveStatusAndRedeploy: [
    param('id').isLength({ min: 15, max: 18 }),
    body('deployOptions').notEmpty(),
    // TODO: make changesetName required if replacementPackageXml is specified
    body('replacementPackageXml').optional().isString(),
    body('changesetName').optional().isString(),
  ],
  getPackageXml: [
    body('metadata').notEmpty(),
    body('metadata').not().isString(),
    body('metadata').not().isArray(),
    body('otherFields').optional().not().isArray(),
    body('otherFields').optional().not().isString(),
  ],
  anonymousApex: [body('apex').isString().isLength({ min: 1 }), body('logLevel').optional().isString().isIn(LOG_LEVELS)],
  apexCompletions: [param('type').isIn(['apex', 'visualforce'])],
};

export function correctInvalidArrayXmlResponseTypes<T = any[]>(item: T[]): T[] {
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
  Object.keys(item!).forEach((key) => {
    if (isString(item[key]) && (item[key] === 'true' || item[key] === 'false')) {
      item[key] = item[key] === 'true';
    } else if (!Array.isArray(item[key]) && isObject(item[key]) && item[key]['$']) {
      // {$: {"xsi:nil": true}}
      item[key] = null;
    }
  });
  return item;
}

export async function describeMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const response = await conn.metadata.describe();

    sendJson(res, response);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function listMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    // for some types, if folder is null then no data will be returned
    const types: { type: string; folder?: string }[] = req.body.types.map(({ type, folder }) => {
      if (folder) {
        return { type, folder };
      }
      return { type };
    });
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const response = await conn.metadata.list(types);

    sendJson(res, correctInvalidArrayXmlResponseTypes(response));
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function readMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const fullNames: string[] = req.body.fullNames;
    const metadataType = req.params.type;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await (
      await Promise.all(splitArrayToMaxSize(fullNames, 10).map((fullNames) => conn.metadata.read(metadataType, fullNames)))
    ).flat();

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deployMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const files: { fullFilename: string; content: string }[] = req.body.files;

    const zip = new JSZip();
    files.forEach((file) => zip.file(file.fullFilename, file.content));

    const results = await conn.metadata.deploy(zip.generateNodeStream(), req.body.options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deployMetadataZip(req: Request, res: Response, next: NextFunction) {
  try {
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const metadataPackage = req.body; // buffer
    // this is validated as valid JSON previously
    const options = JSON.parse(req.query.options as string);

    const results = await conn.metadata.deploy(metadataPackage, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function checkMetadataResults(req: Request, res: Response, next: NextFunction) {
  try {
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const id = req.params.id;
    const includeDetails: boolean = req.query.includeDetails as any; // express validator conversion

    // JSForce has invalid types, and XML is poorly formatted
    let results = (await conn.metadata.checkDeployStatus(id, includeDetails)) as any;

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
      logger.warn('Error converting checkDeployStatus results');
    }

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function retrievePackageFromLisMetadataResults(req: Request, res: Response, next: NextFunction) {
  try {
    const types: MapOf<ListMetadataResult[]> = req.body;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await conn.metadata.retrieve(getRetrieveRequestFromListMetadata(types, conn.version));

    sendJson(res, correctInvalidXmlResponseTypes(results));
  } catch (ex) {
    next(ex);
  }
}

export async function retrievePackageFromExistingServerPackages(req: Request, res: Response, next: NextFunction) {
  try {
    const packageNames: string[] = req.body.packageNames;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const retrieveRequest: RetrieveRequest = {
      apiVersion: conn.version,
      packageNames,
      singlePackage: false,
    };

    const results = await conn.metadata.retrieve(retrieveRequest);

    sendJson(res, correctInvalidXmlResponseTypes(results));
  } catch (ex) {
    next(ex);
  }
}

export async function retrievePackageFromManifest(req: Request, res: Response, next: NextFunction) {
  try {
    const packageManifest: string = req.body.packageManifest;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await conn.metadata.retrieve(getRetrieveRequestFromManifest(packageManifest));

    sendJson(res, correctInvalidXmlResponseTypes(results));
  } catch (ex) {
    next(ex);
  }
}

export async function checkRetrieveStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id: string = req.query.id as string;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await conn.metadata.checkRetrieveStatus(id);
    results.fileProperties = ensureArray(results.fileProperties);
    results.messages = ensureArray(results.messages);
    sendJson(res, correctInvalidXmlResponseTypes(results));
  } catch (ex) {
    next(ex);
  }
}

// TODO: split this into one option to deploy to a changeset
// TODO: get from new shared service (code copied over)
// and another to deploy as-is
export async function checkRetrieveStatusAndRedeploy(req: Request, res: Response, next: NextFunction) {
  try {
    const id: string = req.query.id as string;
    const deployOptions: DeployOptions = req.body.deployOptions;
    const replacementPackageXml: string = req.body.replacementPackageXml;
    const changesetName: string = req.body.changesetName;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const targetConn: jsforce.Connection = res.locals.targetJsforceConn;
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
              conn.version || ENV.SFDC_FALLBACK_API_VERSION
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
          deployOptions
        );
        sendJson(res, { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults), zipFile: results.zipFile });
      } else {
        // Deploy package as-is
        const deployResults = await targetConn.metadata.deploy(oldPackage.generateNodeStream(), deployOptions);
        sendJson(res, { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults), zipFile: results.zipFile });
      }
    } else {
      sendJson(res, { type: 'retrieve', results });
    }
  } catch (ex) {
    next(ex);
  }
}

export async function getPackageXml(req: Request, res: Response, next: NextFunction) {
  try {
    const types: MapOf<ListMetadataResult[]> = req.body.metadata;
    const otherFields: MapOf<string> = req.body.otherFields;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    sendJson(res, buildPackageXml(types, conn.version, otherFields));
  } catch (ex) {
    next(ex);
  }
}

// TODO: use from shared service
/**
 * This uses the SOAP api to allow returning logs
 */
export async function anonymousApex(req: Request, res: Response, next: NextFunction) {
  try {
    // eslint-disable-next-line prefer-const
    let { apex, logLevel }: { apex: string; logLevel?: string } = req.body;
    logLevel = logLevel || 'FINEST';
    const conn: jsforce.Connection = res.locals.jsforceConn;
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
    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}

export async function apexCompletions(req: Request, res: Response, next: NextFunction) {
  try {
    const type = req.params.type;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const requestOptions: jsforce.RequestInfo = {
      method: 'GET',
      url: `${conn.instanceUrl}/services/data/v${conn.version}/tooling/completions?type=${type}`,
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: MIME_TYPES.JSON,
        [HTTP.HEADERS.ACCEPT]: MIME_TYPES.JSON,
      },
    };

    logger.info(requestOptions.url);
    const completions = await conn.request<ApexCompletionResponse>(requestOptions);

    sendJson(res, completions);
  } catch (ex) {
    next(ex);
  }
}
