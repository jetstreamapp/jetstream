import { Prisma, PrismaClient } from '@prisma/client';
import { ENV } from './env-config';

process.on('uncaughtException', function (err) {
  console.log(err);
});

const log: Array<Prisma.LogLevel | Prisma.LogDefinition> = ['info'];

if (ENV.PRISMA_DEBUG) {
  log.push('query');
}

export const prisma = new PrismaClient({
  log,
});
