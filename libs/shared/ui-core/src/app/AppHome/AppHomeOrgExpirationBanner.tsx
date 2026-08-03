import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { ORG_INACTIVITY_EXPIRATION_DAYS } from '@jetstream/shared/utils';
import { ScopedNotification } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Link } from 'react-router';
import { useExpiringOrgs } from '../../orgs/useOrgExpiration';

export const AppHomeOrgExpirationBanner = () => {
  const allOrgs = useAtomValue(fromAppState.salesforceOrgsState);
  const { total, expired, expiringSoon } = useExpiringOrgs(allOrgs);

  if (total === 0) {
    return null;
  }

  const expiredText = expired === 1 ? '1 org has disconnected' : `${expired} orgs have disconnected`;
  const expiringSoonText = expiringSoon === 1 ? '1 org will disconnect soon' : `${expiringSoon} orgs will disconnect soon`;

  let message: string;
  if (expired > 0 && expiringSoon > 0) {
    message = `${expiredText} and ${expiringSoonText}`;
  } else if (expired > 0) {
    message = expiredText;
  } else {
    message = expiringSoonText;
  }

  return (
    <ScopedNotification theme={expired > 0 ? 'error' : 'warning'} className="slds-m-bottom_x-small">
      {message}. Salesforce ends a connection when an org has not been used for {ORG_INACTIVITY_EXPIRATION_DAYS} days, and using an org in
      Jetstream keeps its connection alive. <Link to={APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE}>View and manage your orgs</Link>.
    </ScopedNotification>
  );
};
