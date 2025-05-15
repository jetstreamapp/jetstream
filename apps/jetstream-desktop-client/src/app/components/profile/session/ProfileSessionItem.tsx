import { css } from '@emotion/react';
import { SessionIpData, UserSessionWithLocation } from '@jetstream/auth/types';
import { Badge, Card, Grid } from '@jetstream/ui';
import Bowser from 'bowser';
import { parseISO } from 'date-fns/parseISO';
import startCase from 'lodash/startCase';
import { FunctionComponent, useMemo } from 'react';

export interface ProfileSessionItemProps {
  isCurrentSession: boolean;
  session: UserSessionWithLocation;
  onRevokeSession: (sessionId: string) => void;
}

export const ProfileSessionItem: FunctionComponent<ProfileSessionItemProps> = ({ isCurrentSession, session, onRevokeSession }) => {
  const { expires, ipAddress, location, loginTime, provider, userAgent } = session;

  const { browserName, browserVersion, osName } = useMemo(() => {
    const browser = Bowser.getParser(userAgent);
    return {
      browserName: browser.getBrowserName(),
      browserVersion: browser.getBrowserVersion(),
      osName: browser.getOSName(),
    };
  }, [userAgent]);

  return (
    <Card
      title={
        <Grid verticalAlign="center">
          <span>{osName}</span>
          {isCurrentSession && (
            <Badge className="slds-m-left_x-small" type="default">
              This Device
            </Badge>
          )}
        </Grid>
      }
      actions={
        !isCurrentSession && (
          <button
            className="slds-button"
            css={css`
              color: var(
                --slds-c-button-text-destructive-text-color,
                var(--sds-c-button-text-destructive-text-color, var(--slds-g-color-error-base-30, #ea001e))
              );
              &:hover {
                color: var(
                  --slds-c-button-text-destructive-text-color,
                  var(--sds-c-button-text-destructive-text-color, var(--slds-g-color-error-base-30, #ea001e))
                );
              }
            `}
            onClick={() => onRevokeSession(session.sessionId)}
          >
            Revoke
          </button>
        )
      }
    >
      <p className="slds-text-color_weak">
        {browserName} {browserVersion}
      </p>
      <p className="slds-text-color_weak">
        {ipAddress} {location && <Location location={location} />}
      </p>
      <p className="slds-text-color_weak">Logged in via {provider === 'credentials' ? 'Email & Password' : startCase(provider)}</p>
      <p className="slds-text-color_weak" title={loginTime}>
        <span>Issued at </span>
        {parseISO(loginTime).toLocaleString()}
      </p>
      <p className="slds-text-color_weak" title={expires}>
        <span>Expires at </span>
        {parseISO(expires).toLocaleString()}
      </p>
    </Card>
  );
};

function Location({ location }: { location: SessionIpData }) {
  if (location.status !== 'success') {
    return null;
  }
  const { city, region, countryCode, lat, lon } = location;

  const estimatedLocation = [city, region, countryCode].filter(Boolean).join(', ');

  if (lat && lon) {
    return (
      <span>
        (Est. location:{' '}
        <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer">
          {estimatedLocation}
        </a>
        )
      </span>
    );
  }

  return <span>(Est. location: {estimatedLocation})</span>;
}
