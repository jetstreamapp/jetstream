import { prisma } from '@jetstream/api-config';
import { SessionData } from '@jetstream/auth/types';
import { expect } from '@playwright/test';

export async function verifyEmailLogEntryExists(email: string, subject: string) {
  email = email.toLowerCase();
  // Some emails (e.g. password reset) are sent fire-and-forget, so the activity record may be written
  // shortly after the HTTP response returns. Poll instead of asserting immediately to avoid a race.
  await expect
    .poll(() => prisma.emailActivity.count({ where: { email, subject: { contains: subject } } }), {
      message: `Expected an email activity log entry with subject containing "${subject}" for ${email}`,
    })
    .toBeGreaterThan(0);
}

export async function getPasswordResetToken(email: string) {
  email = email.toLowerCase();
  return await prisma.passwordResetToken.findFirst({ where: { email, expiresAt: { gt: new Date() } } });
}

export async function hasPasswordResetToken(email: string, token: string) {
  email = email.toLowerCase();
  return (await prisma.passwordResetToken.count({ where: { email, token } })) > 0;
}

/**
 * Counts delivery-log rows. Use this to assert an email was NOT sent - verifyEmailLogEntryExists
 * polls for presence and is the wrong tool for proving absence.
 */
export async function countEmailLogEntries(email: string, subject: string) {
  return await prisma.emailActivity.count({ where: { email: email.toLowerCase(), subject: { contains: subject } } });
}

export async function getPendingEmailChangeRequest(userId: string) {
  return await prisma.emailChangeRequest.findFirst({
    where: { userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLatestEmailChangeRequest(userId: string) {
  return await prisma.emailChangeRequest.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function countExternalTokensForUser(userId: string) {
  return await prisma.webExtensionToken.count({ where: { userId } });
}

export async function getUserSessionByEmail(email: string) {
  email = email.toLowerCase();
  const session = await prisma.sessions.findFirstOrThrow({
    where: {
      sess: {
        path: ['user', 'email'],
        equals: email,
      },
    },
  });
  return session.sess as unknown as SessionData;
}

export async function getUserSessionsByEmail(email: string) {
  email = email.toLowerCase();
  const sessions = await prisma.sessions
    .findMany({
      where: {
        sess: {
          path: ['user', 'email'],
          equals: email,
        },
      },
    })
    .then((sessions) => sessions.map((sess) => sess.sess as unknown as SessionData));
  return sessions;
}

export async function getUserSessionById(sessionId: string) {
  const session = await prisma.sessions.findFirstOrThrow({
    where: {
      sid: sessionId,
    },
  });
  return session.sess as unknown as SessionData;
}

export async function getUserByEmail(email: string) {
  email = email.toLowerCase();
  return await prisma.user.findFirstOrThrow({ where: { email } });
}

export async function clearUserTosAcceptance(email: string) {
  email = email.toLowerCase();
  await prisma.user.updateMany({
    where: { email },
    data: { tosAcceptedVersion: null, tosAcceptedAt: null },
  });
}
