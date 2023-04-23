import { ENV, prisma } from '@jetstream/api-config';
import { SalesforceApi } from '@prisma/client';

const VERSION_REPLACE = '{{version}}';

export async function findAll(): Promise<SalesforceApi[]> {
  return (
    await prisma.salesforceApi.findMany({
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
    })
  ).map((item) => {
    item.url = item.url?.replace(VERSION_REPLACE, ENV.SFDC_API_VERSION) || '';
    return item;
  });
}
