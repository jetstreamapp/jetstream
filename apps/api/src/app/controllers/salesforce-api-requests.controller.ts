import { Request, Response } from 'express';
import * as salesforceApiDb from '../db/salesforce-api.db';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  getSalesforceApiRequests: [],
};

export async function getSalesforceApiRequests(req: Request, res: Response) {
  const results = await salesforceApiDb.findAll();
  sendJson(res, results);
}
