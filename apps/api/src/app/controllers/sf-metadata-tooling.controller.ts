import { ENV } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { LOG_LEVELS } from '@jetstream/shared/constants';
import { ListMetadataResult, MapOf } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import type { DeployOptions, RetrieveRequest } from 'jsforce';
import JSZip from 'jszip';
import { isObject, isString } from 'lodash';
import { buildPackageXml, getRetrieveRequestFromListMetadata, getRetrieveRequestFromManifest } from '../services/salesforce.service';
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
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.describe();

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function listMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.list(req.body.types);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function readMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const fullNames: string[] = req.body.fullNames;
    const metadataType = req.params.type;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.read(metadataType, fullNames);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deployMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const files: { fullFilename: string; content: string }[] = req.body.files;
    const options = req.body.options as DeployOptions;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.deployMetadata(files, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deployMetadataZip(req: Request, res: Response, next: NextFunction) {
  try {
    const metadataPackage = req.body as ArrayBuffer; // buffer
    // this is validated as valid JSON previously
    const options = JSON.parse(req.query.options as string);

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.deploy(metadataPackage, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function checkMetadataResults(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const includeDetails: boolean = req.query.includeDetails as any; // express validator conversion

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.checkDeployStatus(id, includeDetails);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function retrievePackageFromLisMetadataResults(req: Request, res: Response, next: NextFunction) {
  try {
    const types: MapOf<ListMetadataResult[]> = req.body;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.retrieve(getRetrieveRequestFromListMetadata(types, jetstreamConn.sessionInfo.apiVersion));

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}

export async function retrievePackageFromExistingServerPackages(req: Request, res: Response, next: NextFunction) {
  try {
    const packageNames: string[] = req.body.packageNames;
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;

    const retrieveRequest: RetrieveRequest = {
      apiVersion: jetstreamConn.sessionInfo.apiVersion,
      packageNames,
      singlePackage: false,
    };

    const results = await jetstreamConn.metadata.retrieve(retrieveRequest);

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}

export async function retrievePackageFromManifest(req: Request, res: Response, next: NextFunction) {
  try {
    const packageManifest: string = req.body.packageManifest;
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.retrieve(getRetrieveRequestFromManifest(packageManifest));

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}

export async function checkRetrieveStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id: string = req.query.id as string;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.metadata.checkRetrieveStatus(id);

    sendJson(res, results);
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
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const targetJetstreamConn = res.locals.targetJetstreamConn as ApiConnection;

    // const results = correctInvalidXmlResponseTypes(await conn.metadata.checkRetrieveStatus(id));
    const results = await jetstreamConn.metadata.checkRetrieveStatus(id);

    if (isString(results.zipFile)) {
      // create a new zip in the correct structure to add to changeset
      if (replacementPackageXml && changesetName) {
        const oldPackage = await JSZip.loadAsync(results.zipFile, { base64: true });
        const newPackage = JSZip();
        newPackage
          .folder('unpackaged')
          ?.file(
            'package.xml',
            `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n\t<version>${
              jetstreamConn.sessionInfo.apiVersion || ENV.SFDC_API_VERSION
            }</version>\n</Package>`
          );

        oldPackage.forEach((relativePath, file) => {
          if (file.name === 'package.xml') {
            newPackage.folder(changesetName)?.file(relativePath, replacementPackageXml);
          } else if (!file.dir) {
            newPackage.folder(changesetName)?.file(relativePath, file.async('uint8array'), { binary: true });
          }
        });
        const deployResults = await targetJetstreamConn.metadata.deploy(
          await newPackage.generateAsync({ type: 'base64', compression: 'STORE', mimeType: 'application/zip', platform: 'UNIX' }),
          deployOptions
        );
        sendJson(res, { type: 'deploy', results: deployResults, zipFile: results.zipFile });
      } else {
        // Deploy package as-is
        const deployResults = await targetJetstreamConn.metadata.deploy(results.zipFile!, deployOptions);
        sendJson(res, { type: 'deploy', results: deployResults, zipFile: results.zipFile });
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
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;

    sendJson(res, buildPackageXml(types, jetstreamConn.sessionInfo.apiVersion, otherFields));
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

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.apex.anonymousApex({ apex, logLevel });

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}

export async function apexCompletions(req: Request, res: Response, next: NextFunction) {
  try {
    const type = req.params.type;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.apex.apexCompletions(type);

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
}
