import * as salesforceApiDb from '../db/salesforce-api.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getSalesforceApiRequests: {
    controllerFn: () => getSalesforceApiRequests,
    validators: { hasSourceOrg: false },
  },
};

const getSalesforceApiRequests = createRoute(routeDefinition.getSalesforceApiRequests.validators, async (_, req, res, next) => {
  try {
    const results = await salesforceApiDb.findAll();
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
