import {
  createEmailStepUpChallenge,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  getAvailableStepUpMethods,
  TOKEN_DURATION_MINUTES,
  verifyStepUpOrThrow,
} from '@jetstream/auth/server';
import { StepUpMethodSchema, StepUpPurposeSchema } from '@jetstream/auth/types';
import { sendVerificationCode } from '@jetstream/email';
import { z } from 'zod';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

/**
 * Step-up (re)authentication - proving identity again from an already-authenticated session before a
 * sensitive action.
 *
 * Deliberately independent of any one feature: routes opt in via the `requireStepUpAuth(purpose)`
 * middleware and a new purpose is added to StepUpPurposeSchema, so nothing here needs to change.
 */
export const routeDefinition = {
  getStepUpMethods: {
    controllerFn: () => getStepUpMethods,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  initStepUpChallenge: {
    controllerFn: () => initStepUpChallenge,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        method: z.literal('email'),
      }),
    } satisfies RouteValidator,
  },
  verifyStepUp: {
    controllerFn: () => verifyStepUp,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        purpose: StepUpPurposeSchema,
        method: StepUpMethodSchema,
        code: z.string().min(6).max(6).optional(),
        password: z.string().min(1).max(1024).optional(),
      }),
    } satisfies RouteValidator,
  },
};

const getStepUpMethods = createRoute(routeDefinition.getStepUpMethods.validators, async ({ user }, _, res) => {
  sendJson(res, await getAvailableStepUpMethods(user.id));
});

const initStepUpChallenge = createRoute(routeDefinition.initStepUpChallenge.validators, async ({ user }, req, res) => {
  const { code, email, expiresAt } = await createEmailStepUpChallenge(req, user.id);
  await sendVerificationCode(email, code, TOKEN_DURATION_MINUTES);
  sendJson(res, { method: 'email', expiresAt: expiresAt.toISOString() });
});

const verifyStepUp = createRoute(routeDefinition.verifyStepUp.validators, async ({ body, user }, req, res) => {
  try {
    const { method, stepUpNonce, expiresAt } = await verifyStepUpOrThrow(req, body);
    sendJson(res, { stepUpNonce, expiresAt: expiresAt.toISOString() });
    createUserActivityFromReq(req, res, {
      action: 'STEP_UP_AUTH',
      method: method.toUpperCase(),
      success: true,
      userId: user.id,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'STEP_UP_AUTH',
      method: body.method.toUpperCase(),
      success: false,
      userId: user.id,
    });
    throw ex;
  }
});
