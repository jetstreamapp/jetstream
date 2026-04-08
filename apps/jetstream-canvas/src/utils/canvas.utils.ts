import { SalesforceOrgUi } from '@jetstream/types';

export function getCanvasOrg(): SalesforceOrgUi {
  const { client, context } = window.sr;
  const { organization, user } = context;
  return {
    id: 1,
    uniqueId: `${organization.organizationId}-${user.userId}`,
    label: user.userName,
    filterText: '',
    accessToken: client.oauthToken,
    instanceUrl: client.instanceUrl,
    loginUrl: client.instanceUrl,
    userId: user.userId,
    email: user.email,
    organizationId: organization.organizationId,
    username: user.userName,
    displayName: user.fullName,
  };
}
