import z from 'zod';
import * as salesforceApiDb from '../db/salesforce-api.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getSalesforceApiRequests: {
    controllerFn: () => getSalesforceApiRequests,
    responseType: z.any().array(),
    validators: { hasSourceOrg: false },
  },
};

const getSalesforceApiRequests = createRoute(routeDefinition.getSalesforceApiRequests.validators, async (_, __, res, next) => {
  try {
    const results = await salesforceApiDb.findAll();
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
