import { logger, prisma } from '@jetstream/api-config';
import type { PendingEmailChange, StepUpMethod } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { AUTH_ERROR_MESSAGES } from '@jetstream/shared/constants';
import type { Maybe } from '@jetstream/types';
import { addHours, addMinutes } from 'date-fns';
import {
  EMAIL_CHANGE_MIN_INTERVAL_HOURS,
  EMAIL_CHANGE_TOKEN_DURATION_MINUTES,
  PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS,
} from './auth.constants';
import { getLoginConfiguration, revokeAllUserSessions, withEmailAddressLock } from './auth.db.service';
import { EmailChangeNotAllowed, InvalidOrExpiredEmailChangeToken } from './auth.errors';
import { generateRandomString } from './auth.service';
import { hashOpaqueToken, timingSafeStringCompare } from './auth.utils';
import { isEmailDomainBlocked } from './blocked-email-domain.db.service';

export type EmailChangeStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'SUPERSEDED' | 'FAILED';
export type EmailChangeResolvedVia = 'USER_PROFILE' | 'EMAIL_LINK' | 'SUPERSEDED' | 'EXPIRED_SWEEP';
type EmailChangeFailureReason = 'EMAIL_IN_USE' | 'STALE_CURRENT_EMAIL' | 'SSO_POLICY' | 'EXPIRED';

/**
 * Single message for every rejection of a confirm or cancel token. The specific reason is recorded
 * on the row and logged, but never returned - otherwise the response would distinguish "wrong token"
 * from "expired", "already used", or "that address is taken", which leaks account state to anyone
 * holding a stale link.
 */
const GENERIC_INVALID_TOKEN_MESSAGE = 'This link is invalid or has expired';

interface RequestContext {
  ipAddress?: Maybe<string>;
  userAgent?: Maybe<string>;
}

/**
 * Policy gate for starting an email change.
 *
 * The checks that a token-holder could otherwise wait out - address availability and SSO policy -
 * are re-evaluated by completeEmailChange, so a data or policy change while a request is in flight
 * cannot be exploited by sitting on a token. The blocked-domain check below is deliberately
 * request-time only: exploiting it would mean the sync adding that exact domain inside the token's
 * short validity window, and re-checking would reject a link the user was legitimately sent with
 * the intentionally generic "invalid or expired" message.
 */
export async function assertEmailChangeAllowedOrThrow({
  userId,
  newEmail,
  client = prisma,
}: {
  userId: string;
  newEmail: string;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const normalizedEmail = newEmail.trim().toLowerCase();

  const user = await client.user.findUniqueOrThrow({
    select: {
      email: true,
      passwordResetAt: true,
      teamMembership: { select: { teamId: true } },
    },
    where: { id: userId },
  });

  if (user.email.toLowerCase() === normalizedEmail) {
    throw new EmailChangeNotAllowed('That is already your email address');
  }

  // Same rule as credentials registration: the user freely chooses this address and we mail it, so a
  // burner domain here is the same deliverability problem - and would otherwise be a trivial way to
  // land on one anyway (register with a real address, then change to a burner).
  if (await isEmailDomainBlocked(normalizedEmail)) {
    logger.warn({ userId }, '[EMAIL_CHANGE] Rejected email change to a blocked email domain');
    throw new EmailChangeNotAllowed(AUTH_ERROR_MESSAGES.EmailDomainNotAllowed);
  }

  // When SSO is enabled the identity provider owns the address: a divergent User.email desyncs the
  // account from the IdP and can leave a password/email-OTP login path that survives IdP
  // deprovisioning. Derived from the database, never from the client-supplied ability.
  if (user.teamMembership?.teamId) {
    const loginConfiguration = await getLoginConfiguration({ teamId: user.teamMembership.teamId });
    if (loginConfiguration?.ssoEnabled && loginConfiguration.ssoProvider !== 'NONE') {
      throw new EmailChangeNotAllowed(
        "Your email address is managed by your organization's single sign-on provider. Contact your administrator to change it.",
      );
    }
  }

  if (user.passwordResetAt && user.passwordResetAt > addHours(new Date(), -PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS)) {
    throw new EmailChangeNotAllowed(
      `For your security, you cannot change your email address within ${PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS} hours of resetting your password.`,
    );
  }

  const recentChange = await client.emailChangeRequest.findFirst({
    select: { resolvedAt: true },
    where: {
      userId,
      status: 'COMPLETED',
      resolvedAt: { gte: addHours(new Date(), -EMAIL_CHANGE_MIN_INTERVAL_HOURS) },
    },
  });
  if (recentChange) {
    throw new EmailChangeNotAllowed(
      `You can only change your email address once every ${EMAIL_CHANGE_MIN_INTERVAL_HOURS} hours. Please try again later.`,
    );
  }

  return { currentEmail: user.email, newEmail: normalizedEmail };
}

/**
 * Whether the address is free to claim. Checks User.email only: that is the column every sign-in and
 * recovery path resolves against (findUsersByEmail, generatePasswordResetToken,
 * getUserAndVerifyPassword, and the final fallback in resolveSsoUser). AuthIdentity.email is never a
 * lookup key - SSO identities are keyed by providerAccountId - so rejecting on it would block
 * legitimate changes without closing anything.
 */
async function isEmailAvailable(email: string, excludeUserId: string, client: Prisma.TransactionClient | typeof prisma) {
  const existing = await client.user.findFirst({
    select: { id: true },
    where: { email: email.toLowerCase(), id: { not: excludeUserId } },
  });

  if (!existing) {
    // Not a blocker, but worth surfacing: an identity carrying this address belongs to someone else.
    const identity = await client.authIdentity.findFirst({
      select: { userId: true },
      where: { email: email.toLowerCase(), userId: { not: excludeUserId } },
    });
    if (identity) {
      logger.warn({ excludeUserId, otherUserId: identity.userId }, '[EMAIL_CHANGE] Target address matches another user identity');
    }
  }

  return !existing;
}

/**
 * Every writer that resolves or creates an email-change request takes BOTH locks, always in this
 * order. Acquiring them together here is what keeps that order impossible to get wrong.
 *
 * The user lock serializes all writers for one account, so a request cannot interleave with a
 * competing request or a confirm - without it, two requests for different addresses would take
 * different address locks, both supersede nothing, and collide on the "one PENDING row per user"
 * partial unique index. The address lock serializes the availability check against the write that
 * depends on it, across different accounts competing for the same address.
 */
async function lockEmailChangeForUpdate(tx: Prisma.TransactionClient, userId: string, email: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`email-change:user:${userId}`}))`;
  await withEmailAddressLock(tx, email);
}

/**
 * Creates a pending request and returns the two plaintext tokens for the caller to email. Returns
 * null when the address is already taken - the caller must respond exactly as it would on success,
 * so the endpoint cannot be used to test whether an address is registered.
 */
export async function createEmailChangeRequest({
  userId,
  newEmail,
  stepUpMethod,
  ipAddress,
  userAgent,
}: {
  userId: string;
  newEmail: string;
  stepUpMethod?: Maybe<StepUpMethod>;
} & RequestContext): Promise<{
  id: string;
  currentEmail: string;
  newEmail: string;
  confirmToken: string;
  cancelToken: string;
  expiresAt: Date;
} | null> {
  const { currentEmail, newEmail: normalizedEmail } = await assertEmailChangeAllowedOrThrow({ userId, newEmail });

  const confirmToken = generateRandomString(32);
  const cancelToken = generateRandomString(32);
  const expiresAt = addMinutes(new Date(), EMAIL_CHANGE_TOKEN_DURATION_MINUTES);

  const created = await prisma.$transaction(async (tx) => {
    await lockEmailChangeForUpdate(tx, userId, normalizedEmail);

    if (!(await isEmailAvailable(normalizedEmail, userId, tx))) {
      // Recorded so support can see the attempt, then reported to the caller as a success.
      await tx.emailChangeRequest.create({
        select: { id: true },
        data: {
          userId,
          status: 'FAILED',
          failureReason: 'EMAIL_IN_USE' satisfies EmailChangeFailureReason,
          currentEmail,
          newEmail: normalizedEmail,
          confirmTokenHash: hashOpaqueToken(confirmToken),
          cancelTokenHash: hashOpaqueToken(cancelToken),
          expiresAt,
          requestedIpAddress: ipAddress,
          requestedUserAgent: userAgent,
          stepUpMethod,
          resolvedAt: new Date(),
          resolvedVia: 'USER_PROFILE' satisfies EmailChangeResolvedVia,
        },
      });
      return null;
    }

    // Supersede rather than delete - the history is permanent.
    await tx.emailChangeRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: {
        status: 'SUPERSEDED' satisfies EmailChangeStatus,
        resolvedAt: new Date(),
        resolvedVia: 'SUPERSEDED' satisfies EmailChangeResolvedVia,
      },
    });

    return tx.emailChangeRequest.create({
      select: { id: true },
      data: {
        userId,
        status: 'PENDING' satisfies EmailChangeStatus,
        currentEmail,
        newEmail: normalizedEmail,
        confirmTokenHash: hashOpaqueToken(confirmToken),
        cancelTokenHash: hashOpaqueToken(cancelToken),
        expiresAt,
        requestedIpAddress: ipAddress,
        requestedUserAgent: userAgent,
        stepUpMethod,
      },
    });
  });

  if (!created) {
    return null;
  }

  return { id: created.id, currentEmail, newEmail: normalizedEmail, confirmToken, cancelToken, expiresAt };
}

async function failRequest(
  tx: Prisma.TransactionClient,
  id: string,
  status: EmailChangeStatus,
  failureReason: EmailChangeFailureReason,
  { ipAddress, userAgent, resolvedVia }: RequestContext & { resolvedVia: EmailChangeResolvedVia },
) {
  await tx.emailChangeRequest.updateMany({
    where: { id, status: 'PENDING' },
    data: {
      status,
      failureReason,
      resolvedAt: new Date(),
      resolvedIpAddress: ipAddress,
      resolvedUserAgent: userAgent,
      resolvedVia,
    },
  });
}

/**
 * Applies a confirmed email change.
 *
 * Everything that must be all-or-nothing happens in one transaction, under the locks taken by
 * lockEmailChangeForUpdate. Third-party calls (Stripe, email) are deliberately left to the caller:
 * holding a database transaction open across them would pin a connection for seconds and let a
 * provider outage cascade into connection exhaustion.
 */
export async function completeEmailChange({
  confirmToken,
  resolvedVia,
  currentSession,
  ipAddress,
  userAgent,
}: {
  confirmToken: string;
  resolvedVia: EmailChangeResolvedVia;
  /**
   * The session performing the confirmation, if any. It is spared from revocation only when it
   * belongs to the account being changed - the target user is resolved from the token row, so
   * confirming while signed in as somebody else cannot preserve that other session's access.
   */
  currentSession?: Maybe<{ id: string; userId: Maybe<string> }>;
} & RequestContext): Promise<{ requestId: string; userId: string; oldEmail: string; newEmail: string }> {
  const confirmTokenHash = hashOpaqueToken(confirmToken);

  // Advisory only - every field is re-read authoritatively under the lock below.
  const preRead = await prisma.emailChangeRequest.findUnique({
    select: { userId: true, newEmail: true },
    where: { confirmTokenHash },
  });
  if (!preRead) {
    throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
  }

  return prisma.$transaction(async (tx) => {
    await lockEmailChangeForUpdate(tx, preRead.userId, preRead.newEmail);

    const request = await tx.emailChangeRequest.findUnique({ where: { confirmTokenHash } });
    if (!request) {
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    const context = { ipAddress, userAgent, resolvedVia };

    if (request.status !== 'PENDING') {
      logger.warn({ requestId: request.id, status: request.status }, '[EMAIL_CHANGE][CONFIRM] Request is not pending');
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    if (request.expiresAt < new Date()) {
      await failRequest(tx, request.id, 'EXPIRED', 'EXPIRED', context);
      logger.warn({ requestId: request.id }, '[EMAIL_CHANGE][CONFIRM] Request is expired');
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    // No per-request attempt counter exists, and none is possible: the token hash is the primary key
    // of the lookup, so a wrong token resolves to no row and there is nothing to charge an attempt
    // against. Guessing is bounded by the 32-byte token and emailChangeTokenRateLimit instead.

    // Belt and braces over the indexed equality lookup that found this row.
    if (!timingSafeStringCompare(request.confirmTokenHash, confirmTokenHash)) {
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    const user = await tx.user.findUniqueOrThrow({
      select: { id: true, email: true, teamMembership: { select: { teamId: true } } },
      where: { id: request.userId },
    });

    // Another change (or an admin edit) landed after this request was created, so the "from" address
    // it was authorized against no longer holds.
    if (user.email.toLowerCase() !== request.currentEmail.toLowerCase()) {
      await failRequest(tx, request.id, 'SUPERSEDED', 'STALE_CURRENT_EMAIL', context);
      logger.warn({ requestId: request.id }, '[EMAIL_CHANGE][CONFIRM] Current email no longer matches the request');
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    // Closes the request-to-confirm race: the address may have been claimed in the interim.
    if (!(await isEmailAvailable(request.newEmail, user.id, tx))) {
      await failRequest(tx, request.id, 'FAILED', 'EMAIL_IN_USE', context);
      logger.warn({ requestId: request.id }, '[EMAIL_CHANGE][CONFIRM] Target address is already in use');
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    // Re-checked here and not only at request time, so a team enabling SSO mid-flight cannot be
    // sidestepped by holding a token issued beforehand.
    if (user.teamMembership?.teamId) {
      const loginConfiguration = await getLoginConfiguration({ teamId: user.teamMembership.teamId });
      if (loginConfiguration?.ssoEnabled && loginConfiguration.ssoProvider !== 'NONE') {
        await failRequest(tx, request.id, 'FAILED', 'SSO_POLICY', context);
        logger.warn({ requestId: request.id }, '[EMAIL_CHANGE][CONFIRM] Blocked by SSO policy');
        throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
      }
    }

    const oldEmail = user.email;
    const newEmail = request.newEmail.toLowerCase();

    await tx.user.update({
      data: { email: newEmail, emailVerified: true },
      where: { id: user.id },
    });

    // Keeps a credentials identity aligned with the account address. Accounts created by the current
    // code have no credentials AuthIdentity row at all, so this is a no-op for them - it exists for
    // legacy/migrated rows, where username may hold the login handle. oauth and sso identities are
    // deliberately untouched: those addresses are what the external provider asserted, and legacy SSO
    // rows are matched on providerAccountId, so rewriting them would corrupt the profile for nothing.
    await tx.$executeRaw`
      UPDATE "AuthIdentity"
         SET email = ${newEmail},
             "emailVerified" = true,
             username = CASE WHEN lower(username) = lower(${oldEmail}) THEN ${newEmail} ELSE username END
       WHERE "userId" = ${user.id}::uuid AND type = 'credentials'
    `;

    // A live reset token was mailed to the address being vacated - whoever inherits that mailbox
    // could otherwise use it to take the account back. Scoped by userId rather than email because
    // PasswordResetToken is keyed by address, and deleting by the old address would also destroy a
    // duplicate-email user's live token.
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Inside the transaction so a partially-applied change can never leave a live session behind.
    // This also clears every desktop and browser-extension token for the user.
    const exceptSessionId = currentSession?.userId === user.id ? currentSession.id : undefined;
    await revokeAllUserSessions(user.id, exceptSessionId, tx);

    const { count } = await tx.emailChangeRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: {
        status: 'COMPLETED' satisfies EmailChangeStatus,
        resolvedAt: new Date(),
        resolvedIpAddress: ipAddress,
        resolvedUserAgent: userAgent,
        resolvedVia,
      },
    });
    // A concurrent cancel slipped in; it wins and this confirm is rolled back.
    if (count !== 1) {
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    return { requestId: request.id, userId: user.id, oldEmail, newEmail };
  });
}

async function cancelPendingRequest(
  where: Prisma.EmailChangeRequestWhereInput,
  { ipAddress, userAgent, resolvedVia }: RequestContext & { resolvedVia: EmailChangeResolvedVia },
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.emailChangeRequest.findFirst({
      select: { id: true, userId: true, currentEmail: true, newEmail: true, status: true },
      where,
    });

    if (!request || request.status !== 'PENDING') {
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    const { count } = await tx.emailChangeRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: {
        status: 'CANCELLED' satisfies EmailChangeStatus,
        resolvedAt: new Date(),
        resolvedIpAddress: ipAddress,
        resolvedUserAgent: userAgent,
        resolvedVia,
      },
    });
    if (count !== 1) {
      throw new InvalidOrExpiredEmailChangeToken(GENERIC_INVALID_TOKEN_MESSAGE);
    }

    return { requestId: request.id, userId: request.userId, currentEmail: request.currentEmail, newEmail: request.newEmail };
  });
}

/** Cancel via the link sent to the old address - unauthenticated, so the token is the only authority. */
export async function cancelEmailChangeByToken({ cancelToken, ipAddress, userAgent }: { cancelToken: string } & RequestContext) {
  return cancelPendingRequest({ cancelTokenHash: hashOpaqueToken(cancelToken) }, { ipAddress, userAgent, resolvedVia: 'EMAIL_LINK' });
}

/** Cancel from the profile page, scoped to the signed-in user. */
export async function cancelEmailChangeByUser({ userId, ipAddress, userAgent }: { userId: string } & RequestContext) {
  return cancelPendingRequest({ userId, status: 'PENDING' }, { ipAddress, userAgent, resolvedVia: 'USER_PROFILE' });
}

export async function getPendingEmailChangeForUser(userId: string): Promise<PendingEmailChange | null> {
  const request = await prisma.emailChangeRequest.findFirst({
    select: { id: true, newEmail: true, createdAt: true, expiresAt: true },
    where: { userId, status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!request) {
    return null;
  }

  return {
    id: request.id,
    newEmail: request.newEmail,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
  };
}

/**
 * Flips abandoned requests to a terminal state. Deliberately never deletes - this table is the
 * permanent history of the action.
 */
export async function expirePendingEmailChangeRequests() {
  const { count } = await prisma.emailChangeRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: {
      status: 'EXPIRED' satisfies EmailChangeStatus,
      failureReason: 'EXPIRED' satisfies EmailChangeFailureReason,
      resolvedAt: new Date(),
      resolvedVia: 'EXPIRED_SWEEP' satisfies EmailChangeResolvedVia,
    },
  });
  return count;
}
