import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import { sendJson } from '../utils/response.handlers';
import { UserFacingError } from '../utils/error-handler';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { body, param, query } from 'express-validator';
import * as JSZip from 'jszip';

export const routeValidators = {
  listMetadata: [body('types').isArray().isLength({ min: 1 })],
  readMetadata: [body('fullNames').isArray().isLength({ min: 1 })],
  deployMetadata: [body('files').isArray().isLength({ min: 1 })],
  checkMetadataResults: [param('id').isLength({ min: 15, max: 18 }), query('includeDetails').toBoolean()],
};

export async function listMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const types: { type: string; folder?: string }[] = req.body.types;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const response = await conn.metadata.list(types);

    sendJson(res, response);
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
