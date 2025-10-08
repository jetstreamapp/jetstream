import { css } from '@emotion/react';
import { SessionIpData, TokenSource, UserSessionWithLocation } from '@jetstream/auth/types';
import { getBrowserInfo } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Badge, Card, Grid, SessionLocationDisplay } from '@jetstream/ui';
import { parseISO } from 'date-fns/parseISO';
import startCase from 'lodash/startCase';
import { FunctionComponent, useMemo } from 'react';

export interface ProfileSessionItemProps {
  isCurrentSession?: boolean;
  type: 'SESSION' | 'EXTERNAL_SESSION';
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  provider?: UserSessionWithLocation['provider'];
  source?: TokenSource;
  userAgent: string;
  location?: Maybe<SessionIpData>;
  onRevokeSession: (sessionId: string, type: 'SESSION' | 'EXTERNAL_SESSION') => void;
}

export const ProfileSessionItem: FunctionComponent<ProfileSessionItemProps> = ({
  isCurrentSession = false,
  type,
  sessionId,
  createdAt,
  expiresAt,
  ipAddress,
  location,
  provider,
  source,
  userAgent,
  onRevokeSession,
}) => {
  const { browserName, browserVersion, osName } = useMemo(() => getBrowserInfo(userAgent), [userAgent]);

  return (
    <Card
      title={
        <Grid verticalAlign="center">
          {source === 'BROWSER_EXTENSION' && <span>Web Extension - {osName}</span>}
          {source === 'DESKTOP' && <span>Desktop - {osName}</span>}
          {!source && <span>{osName}</span>}
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
            onClick={() => onRevokeSession(sessionId, type)}
          >
            Revoke
          </button>
        )
      }
    >
      {type === 'EXTERNAL_SESSION' && <p className="slds-text-color_weak">External Session</p>}
      <p className="slds-text-color_weak">
        {browserName} {browserVersion}
      </p>
      <p className="slds-text-color_weak">
        {ipAddress} {location && <SessionLocationDisplay location={location} />}
      </p>
      {provider && (
        <p className="slds-text-color_weak">Logged in via {provider === 'credentials' ? 'Email & Password' : startCase(provider)}</p>
      )}
      <p className="slds-text-color_weak" title={createdAt}>
        <span>Issued at </span>
        {parseISO(createdAt).toLocaleString()}
      </p>
      <p className="slds-text-color_weak" title={expiresAt}>
        <span>Expires at </span>
        {parseISO(expiresAt).toLocaleString()}
      </p>
    </Card>
  );
};
