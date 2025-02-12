import { ApiConnection } from '@jetstream/salesforce-api';
import { initApiClient } from './api-client';
import { sendMessage } from './web-extension.utils';

export async function getApiClientFromHost(sfHost: string): Promise<ApiConnection> {
  const connection = await sendMessage({ message: 'GET_CURRENT_ORG', data: { sfHost } });
  const { sessionInfo, org } = connection;
  const apiConnection = initApiClient(sessionInfo);
  return apiConnection;
}
