import { ENV } from 'apps/api/src/app/config/env-config';
import { Request, Response } from 'express';
import { SalesforceApi } from '../db/entites/SalesforceApi';
import { sendJson } from '../utils/response.handlers';

const VERSION_REPLACE = '{{version}}';

export const routeValidators = {
  getSalesforceApiRequests: [],
};

export async function getSalesforceApiRequests(req: Request, res: Response) {
  const results = await SalesforceApi.getAll();
  results.forEach((result) => {
    result.url = result.url.replace(VERSION_REPLACE, ENV.SFDC_FALLBACK_API_VERSION);
  });
  sendJson(res, results);
}
