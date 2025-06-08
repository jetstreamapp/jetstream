import { LoginActivityUserFacing } from '@jetstream/auth/types';
import { Card } from '@jetstream/ui';
import { parseISO } from 'date-fns/parseISO';
import { FunctionComponent, useMemo } from 'react';
import { getBrowserInfo } from './browser-session.utils';
import { ProfileSessionLocation } from './ProfileSessionLocation';

export interface ProfileLoginActivityItemProps {
  loginActivity: LoginActivityUserFacing;
}

export const ProfileLoginActivityItem: FunctionComponent<ProfileLoginActivityItemProps> = ({ loginActivity }) => {
  const { action, createdAt, ipAddress, success, userAgent, location } = loginActivity;
  const { browserName, browserVersion, osName } = useMemo(
    () =>
      userAgent
        ? getBrowserInfo(userAgent)
        : {
            browserName: '',
            browserVersion: '',
            osName: '',
          },
    [userAgent]
  );

  return (
    <Card>
      <p className="text-bold">{action}</p>
      {browserName && (
        <p className="slds-text-color_weak">
          {osName} - {browserName} {browserVersion}
        </p>
      )}
      <p className="slds-text-color_weak">
        {ipAddress} {location && <ProfileSessionLocation location={location} />}
      </p>
      <p className="slds-text-color_weak" title={createdAt}>
        {parseISO(createdAt).toLocaleString()}
      </p>
      {success ? <p className="slds-text-color_success">Successful</p> : <p className="slds-text-color_error">Failed</p>}
    </Card>
  );
};
