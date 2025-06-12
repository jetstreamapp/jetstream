import { prisma } from '@jetstream/api-config';
import { test as teardown } from '@playwright/test';

teardown('login and ensure org exists', async ({ page, request }) => {
  console.log('GLOBAL TEARDOWN - STARTED');
  let results = await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: 'test-',
        endsWith: '@getjetstream.app',
      },
    },
  });
  console.log(`Deleted ${results.count} users + dependent records`);

  results = await prisma.passwordResetToken.deleteMany({
    where: {
      email: {
        startsWith: 'test-',
        endsWith: '@getjetstream.app',
      },
    },
  });
  console.log(`Deleted ${results.count} passwordResetToken records`);

  results = await prisma.loginActivity.deleteMany({
    where: {
      email: {
        startsWith: 'test-',
        endsWith: '@getjetstream.app',
      },
    },
  });
  console.log(`Deleted ${results.count} loginActivity records`);

  results = await prisma.emailActivity.deleteMany({
    where: {
      email: {
        startsWith: 'test-',
        endsWith: '@getjetstream.app',
      },
    },
  });
  console.log(`Deleted ${results.count} emailActivity records`);

  results = await prisma.sessions.deleteMany({
    where: {
      sess: {
        path: ['user', 'email'],
        string_starts_with: 'test-',
        string_ends_with: '@getjetstream.app',
      },
    },
  });
  console.log(`Deleted ${results.count} session records`);

  results = await prisma.loginConfiguration.deleteMany({
    where: {
      domains: { has: 'example.com' },
    },
  });
  console.log(`Deleted ${results.count} loginConfiguration records`);
});
