import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { ScopedNotification } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Link } from 'react-router-dom';
import { useExpiringOrgs } from '../../orgs/useOrgExpiration';

export const AppHomeOrgExpirationBanner = () => {
  const allOrgs = useAtomValue(fromAppState.salesforceOrgsState);
  const { total, expired, expiringSoon } = useExpiringOrgs(allOrgs);

  if (total === 0) {
    return null;
  }

  const expiredText = expired === 1 ? '1 org has expired' : `${expired} orgs have expired`;
  const expiringSoonText = expiringSoon === 1 ? '1 org is expiring soon' : `${expiringSoon} orgs are expiring soon`;

  let message: string;
  if (expired > 0 && expiringSoon > 0) {
    message = `${expiredText} and ${expiringSoonText}`;
  } else if (expired > 0) {
    message = expiredText;
  } else {
    message = expiringSoonText;
  }

  return (
    <ScopedNotification theme="info" className="slds-m-bottom_x-small">
      {message} due to 90 days of inactivity. <Link to={APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE}>View and manage your orgs</Link> to
      reactivate them.
    </ScopedNotification>
  );
};
