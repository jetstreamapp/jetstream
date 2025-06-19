import { prisma } from '@jetstream/api-config';
import { SessionData } from '@jetstream/auth/types';

export async function verifyEmailLogEntryExists(email: string, subject: string) {
  email = email.toLowerCase();
  await prisma.emailActivity.findFirstOrThrow({ where: { email, subject: { contains: subject } } });
}

export async function getPasswordResetToken(email: string) {
  email = email.toLowerCase();
  return await prisma.passwordResetToken.findFirst({ where: { email, expiresAt: { gt: new Date() } } });
}

export async function hasPasswordResetToken(email: string, token: string) {
  email = email.toLowerCase();
  return (await prisma.passwordResetToken.count({ where: { email, token } })) > 0;
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
