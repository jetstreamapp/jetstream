import * as salesforceApiDb from '../db/salesforce-api.db';
import { Request, Response } from '../types/types';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  getSalesforceApiRequests: [],
};

export async function getSalesforceApiRequests(req: Request, res: Response) {
  const results = await salesforceApiDb.findAll();
  sendJson(res, results);
}
