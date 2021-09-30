import { SalesforceApi } from '@prisma/client';
import { prisma } from '../config/db.config';
import { ENV } from '../config/env-config';

const VERSION_REPLACE = '{{version}}';

export async function findAll(): Promise<SalesforceApi[]> {
  return (
    await prisma.salesforceApi.findMany({
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
    })
  ).map((item) => {
    item.url = item.url.replace(VERSION_REPLACE, ENV.SFDC_FALLBACK_API_VERSION);
    return item;
  });
}
