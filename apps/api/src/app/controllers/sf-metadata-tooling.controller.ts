import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataResult, MapOf } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { DeployOptions, RetrieveRequest } from 'jsforce';
import * as JSZip from 'jszip';
import { isObject, isString } from 'lodash';
import { buildPackageXml, getRetrieveRequestFromListMetadata, getRetrieveRequestFromManifest } from '../services/sf-misc';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createWriteStream } from 'fs';

export const routeValidators = {
  listMetadata: [body('types').isArray().isLength({ min: 1 })],
  readMetadata: [body('fullNames').isArray().isLength({ min: 1 })],
  deployMetadata: [body('files').isArray().isLength({ min: 1 })],
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
  Object.keys(item).forEach((key) => {
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

export async function checkMetadataResults(req: Request, res: Response, next: NextFunction) {
  try {
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const id = req.params.id;
    const includeDetails: boolean = req.query.includeDetails as any; // express validator conversion

    const results = await conn.metadata.checkDeployStatus(id, includeDetails);

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

    sendJson(res, correctInvalidXmlResponseTypes(results));
  } catch (ex) {
    next(ex);
  }
}

// TODO: split this into one option to deploy to a changeset
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
          .file(
            'package.xml',
            `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n\t<version>50.0</version>\n</Package>`
          );

        oldPackage.forEach((relativePath, file) => {
          if (file.name === 'package.xml') {
            newPackage.folder(changesetName).file(relativePath, replacementPackageXml);
          } else if (!file.dir) {
            newPackage.folder(changesetName).file(relativePath, file.async('uint8array'), { binary: true });
          }
        });
        const deployResults = await targetConn.metadata.deploy(
          await newPackage.generateAsync({ type: 'base64', compression: 'STORE', mimeType: 'application/zip', platform: 'UNIX' }),
          deployOptions
        );
        sendJson(res, { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults) });
      } else {
        // Deploy package as-is
        const deployResults = await targetConn.metadata.deploy(oldPackage.generateNodeStream(), deployOptions);
        sendJson(res, { type: 'deploy', results: correctInvalidXmlResponseTypes(deployResults) });
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
    // otherFields

    sendJson(res, buildPackageXml(types, conn.version, otherFields));
  } catch (ex) {
    next(ex);
  }
}
