import { ENV, getLogger } from '@jetstream/api-config';
import {
  cancelEmailChangeByToken,
  cancelEmailChangeByUser,
  completeEmailChange,
  createEmailChangeRequest,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  EMAIL_CHANGE_TOKEN_DURATION_MINUTES,
  getPendingEmailChangeForUser,
  maskEmail,
  refreshSessionUser,
  verifyCSRFFromRequestOrThrow,
} from '@jetstream/auth/server';
import { sendAuthenticationChangeConfirmation, sendEmailChangeRequestedNotice, sendEmailChangeVerification } from '@jetstream/email';
import { EmailSchema } from '@jetstream/types';
import { z } from 'zod';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

/**
 * Tokens are echoed back to the caller ONLY outside of production, so end-to-end tests can complete
 * the flow without a mail catcher. Guarded exactly like the rate-limit bypass in route.utils.
 */
const shouldEchoTokensForTesting = () => ENV.CI || ENV.ENVIRONMENT === 'development';

export const routeDefinition = {
  getEmailChange: {
    controllerFn: () => getEmailChange,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  requestEmailChange: {
    controllerFn: () => requestEmailChange,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      // Step-up is enforced by the requireStepUpAuth middleware on the route, not here.
      body: z.object({
        newEmail: EmailSchema,
        // Optional so the FIRST attempt - which has no grant yet - passes validation and reaches the
        // step-up check, which answers with the 403 that opens the re-authentication prompt.
        // Rejecting it here instead would return a 400 and the prompt would never appear.
        // consumeStepUpAuthOrThrow still requires an exact match once a grant exists.
        stepUpNonce: z.string().min(1).max(128).optional(),
      }),
    } satisfies RouteValidator,
  },
  cancelEmailChange: {
    controllerFn: () => cancelEmailChange,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  confirmEmailChangeAuthenticated: {
    controllerFn: () => confirmEmailChangeAuthenticated,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        token: z.string().min(1).max(128),
      }),
    } satisfies RouteValidator,
  },
  confirmEmailChangeByToken: {
    controllerFn: () => confirmEmailChangeByToken,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        // These routes live under /api/auth, which does not pass through validateDoubleCSRF, so the
        // token travels in the body and is checked in the handler like every other auth route.
        csrfToken: z.string(),
        token: z.string().min(1).max(128),
      }),
    } satisfies RouteValidator,
  },
  cancelEmailChangeByTokenRoute: {
    controllerFn: () => cancelEmailChangeByTokenRoute,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        csrfToken: z.string(),
        token: z.string().min(1).max(128),
      }),
    } satisfies RouteValidator,
  },
};

const getEmailChange = createRoute(routeDefinition.getEmailChange.validators, async ({ user }, _, res) => {
  sendJson(res, await buildEmailChangeResponse(user.id));
});

const requestEmailChange = createRoute(routeDefinition.requestEmailChange.validators, async ({ body, user }, req, res) => {
  const { newEmail } = body;

  try {
    const request = await createEmailChangeRequest({
      userId: user.id,
      newEmail,
      // Set by the requireStepUpAuth middleware; consuming the grant clears it from the session.
      stepUpMethod: res.locals.stepUpMethod,
      ipAddress: res.locals.ipAddress,
      userAgent: req.get('user-agent'),
    });

    if (!request) {
      // The address belongs to someone else. Respond exactly as on success and send nothing, so the
      // endpoint cannot be used to discover whether an address is registered. The attempt is recorded.
      getLogger().warn({ userId: user.id }, '[EMAIL_CHANGE][REQUEST] Target address already in use');
      createUserActivityFromReq(req, res, {
        action: 'EMAIL_CHANGE_FAILED',
        method: 'USER_PROFILE',
        success: false,
        errorMessage: 'EMAIL_IN_USE',
        userId: user.id,
      });
      sendJson(res, await buildEmailChangeResponse(user.id));
      return;
    }

    await sendNotifications('[EMAIL_CHANGE][REQUEST]', [
      {
        recipient: 'new-address',
        send: sendEmailChangeVerification(request.newEmail, {
          token: request.confirmToken,
          currentEmailMasked: maskEmail(request.currentEmail),
          expMinutes: EMAIL_CHANGE_TOKEN_DURATION_MINUTES,
        }),
      },
      {
        recipient: 'current-address',
        send: sendEmailChangeRequestedNotice(request.currentEmail, {
          newEmail: request.newEmail,
          cancelToken: request.cancelToken,
          expMinutes: EMAIL_CHANGE_TOKEN_DURATION_MINUTES,
        }),
      },
    ]);

    sendJson(res, {
      ...(await buildEmailChangeResponse(user.id)),
      ...(shouldEchoTokensForTesting() ? { confirmToken: request.confirmToken, cancelToken: request.cancelToken } : {}),
    });

    createUserActivityFromReq(req, res, {
      action: 'EMAIL_CHANGE_REQUEST',
      method: 'USER_PROFILE',
      success: true,
      userId: user.id,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'EMAIL_CHANGE_REQUEST',
      method: 'USER_PROFILE',
      success: false,
      userId: user.id,
    });
    throw ex;
  }
});

async function buildEmailChangeResponse(userId: string) {
  return { pendingEmailChange: await getPendingEmailChangeForUser(userId) };
}

/**
 * Sends the notifications for an email-change transition. Every one of them is best-effort: the
 * state change is already durable by this point, so a mail provider failure must never surface to
 * the caller or undo it - but it must not vanish either. A verification link that was never
 * delivered leaves a PENDING request the user cannot act on, and without this log there is nothing
 * for support to find. Recipients are identified by role rather than address to keep mailboxes out
 * of the logs.
 */
async function sendNotifications(logTag: string, notifications: Array<{ recipient: string; send: Promise<unknown> }>) {
  const results = await Promise.allSettled(notifications.map(({ send }) => send));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      getLogger().error({ err: result.reason, recipient: notifications[index].recipient }, `${logTag} Unable to send notification email`);
    }
  });
}

const cancelEmailChange = createRoute(routeDefinition.cancelEmailChange.validators, async ({ user }, req, res) => {
  const { currentEmail, newEmail } = await cancelEmailChangeByUser({
    userId: user.id,
    ipAddress: res.locals.ipAddress,
    userAgent: req.get('user-agent'),
  });

  await sendNotifications('[EMAIL_CHANGE][CANCEL]', [
    {
      recipient: 'current-address',
      send: sendAuthenticationChangeConfirmation(currentEmail, 'Your email change request was cancelled', {
        heading: 'The request to change your email address was cancelled',
        additionalTextSegments: [`Your account email address is unchanged. The request to move it to ${newEmail} will not proceed.`],
      }),
    },
  ]);

  sendJson(res, await buildEmailChangeResponse(user.id));

  createUserActivityFromReq(req, res, {
    action: 'EMAIL_CHANGE_CANCELLED',
    method: 'USER_PROFILE',
    success: true,
    userId: user.id,
  });
});

/**
 * Applies the change, then performs the follow-up work that must not be able to roll it back:
 * notifying both addresses and syncing the billing provider. Each is independently failure-tolerant.
 */
async function finalizeEmailChange({ userId, oldEmail, newEmail }: { userId: string; oldEmail: string; newEmail: string }) {
  try {
    const billing = await userDbService.getBillingAccount(userId);
    // Only a personal billing account. When the user belongs to a team, getBillingAccount returns
    // the TEAM's Stripe customer, which is shared - repointing it at one member's new address would
    // redirect the whole team's invoices.
    if (billing?.customerId && billing.teamId === null) {
      await stripeService.updateCustomerEmail(billing.customerId, newEmail);
    }
  } catch (ex) {
    // The change is durable and every session is already gone - a billing sync failure must not
    // surface to the user or undo any of that.
    getLogger().error({ err: ex, userId }, '[EMAIL_CHANGE][COMPLETE] Unable to sync billing customer email');
  }

  await sendNotifications('[EMAIL_CHANGE][COMPLETE]', [
    {
      recipient: 'old-address',
      send: sendAuthenticationChangeConfirmation(oldEmail, 'Your Jetstream email address was changed', {
        heading: 'The email address on your account was changed',
        // Shown in full: this mailbox is the previous account holder and needs the value to recognize
        // a change they did not make.
        additionalTextSegments: [
          `Your Jetstream account now uses ${newEmail}. You have been signed out everywhere, including the desktop app and browser extension.`,
        ],
      }),
    },
    {
      recipient: 'new-address',
      send: sendAuthenticationChangeConfirmation(newEmail, 'Your Jetstream email address was changed', {
        heading: 'This is now the email address on your Jetstream account',
        additionalTextSegments: [`Your account previously used ${maskEmail(oldEmail)}. Sign in with this address from now on.`],
      }),
    },
  ]);
}

const confirmEmailChangeAuthenticated = createRoute(
  routeDefinition.confirmEmailChangeAuthenticated.validators,
  async ({ body, user }, req, res) => {
    const result = await completeEmailChange({
      confirmToken: body.token,
      resolvedVia: 'USER_PROFILE',
      // Spared from revocation only if this session turns out to belong to the account the token
      // targets - completeEmailChange resolves that from the token row, not from who is signed in.
      currentSession: { id: req.session.id, userId: user.id },
      ipAddress: res.locals.ipAddress,
      userAgent: req.get('user-agent'),
    });

    await finalizeEmailChange(result);

    if (req.session.user?.id === result.userId) {
      // The denormalized snapshot on this session still carries the old address.
      await refreshSessionUser(req);
    }

    sendJson(res, await userDbService.findUserWithIdentitiesById(result.userId));

    createUserActivityFromReq(req, res, {
      action: 'EMAIL_CHANGE_COMPLETED',
      method: 'USER_PROFILE',
      success: true,
      userId: result.userId,
      email: result.newEmail,
    });
  },
);

const confirmEmailChangeByToken = createRoute(routeDefinition.confirmEmailChangeByToken.validators, async ({ body }, req, res) => {
  await verifyCSRFFromRequestOrThrow(body.csrfToken, req.headers.cookie || '');

  // Unauthenticated: the identity comes from the token row, never from whoever happens to be signed
  // in on this browser. currentSessionId is intentionally omitted so every session for the target
  // user is revoked.
  const result = await completeEmailChange({
    confirmToken: body.token,
    resolvedVia: 'EMAIL_LINK',
    ipAddress: res.locals.ipAddress,
    userAgent: req.get('user-agent'),
  });

  await finalizeEmailChange(result);

  sendJson(res, { success: true, email: result.newEmail });

  createUserActivityFromReq(req, res, {
    action: 'EMAIL_CHANGE_COMPLETED',
    method: 'EMAIL_LINK',
    success: true,
    userId: result.userId,
    email: result.newEmail,
  });
});

const cancelEmailChangeByTokenRoute = createRoute(routeDefinition.cancelEmailChangeByTokenRoute.validators, async ({ body }, req, res) => {
  await verifyCSRFFromRequestOrThrow(body.csrfToken, req.headers.cookie || '');

  const { userId, currentEmail, newEmail } = await cancelEmailChangeByToken({
    cancelToken: body.token,
    ipAddress: res.locals.ipAddress,
    userAgent: req.get('user-agent'),
  });

  await sendNotifications('[EMAIL_CHANGE][CANCEL]', [
    {
      recipient: 'current-address',
      send: sendAuthenticationChangeConfirmation(currentEmail, 'Your email change request was cancelled', {
        heading: 'The request to change your email address was cancelled',
        additionalTextSegments: [
          `Your account email address is unchanged. The request to move it to ${newEmail} will not proceed.`,
          'If you did not start this request, reset your password now - someone else may have access to your account.',
        ],
      }),
    },
  ]);

  sendJson(res, { success: true });

  createUserActivityFromReq(req, res, {
    action: 'EMAIL_CHANGE_CANCELLED',
    method: 'EMAIL_LINK',
    success: true,
    userId,
  });
});
