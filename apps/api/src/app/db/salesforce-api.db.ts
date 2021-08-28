import { SalesforceApi } from '@prisma/client';
import { prisma } from 'apps/api/src/app/config/db.config';
import { ENV } from 'apps/api/src/app/config/env-config';

const VERSION_REPLACE = '{{version}}';

export async function findAll(): Promise<SalesforceApi[]> {
  return (await prisma.salesforceApi.findMany()).map((item) => {
    item.url = item.url.replace(VERSION_REPLACE, ENV.SFDC_FALLBACK_API_VERSION);
    return item;
  });
}
