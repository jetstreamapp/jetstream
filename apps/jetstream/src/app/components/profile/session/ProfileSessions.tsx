import { css } from '@emotion/react';
import { DropDownItem } from '@jetstream/types';
import { Card, DropDown, Grid, ScopedNotification, Spinner } from '@jetstream/ui';
import partition from 'lodash/partition';
import { useMemo } from 'react';
import { useSessionData } from '../useSessionData';
import { ProfileSessionItem } from './ProfileSessionItem';

const items: DropDownItem[] = [
  {
    id: 'revoke-all',
    value: 'Revoke All Other Sessions',
    icon: { type: 'utility', icon: 'delete', description: 'Delete' },
  },
];

export const ProfileSessions = ({ sessionData }: { sessionData: ReturnType<typeof useSessionData> }) => {
  const { errorMessage, isLoading, revokeAllSessions, revokeSession } = sessionData;
  const { currentSessionId, sessions, webTokenSessions } = sessionData.sessions;

  const [currentSession, otherSessions] = useMemo(() => {
    return partition(sessions, (session) => session.sessionId === currentSessionId);
  }, [currentSessionId, sessions]);

  async function handleMenuAction(action: string) {
    if (action === 'revoke-all') {
      revokeAllSessions();
    }
  }

  return (
    <Card
      className="slds-is-relative"
      bodyClassName={null}
      title={
        <Grid verticalAlign="center">
          Sessions{' '}
          {isLoading && currentSession && (
            <Spinner
              className="slds-m-left_x-small slds-m-top_x-small slds-spinner slds-spinner_brand slds-spinner_x-small slds-spinner_inline"
              hasContainer={false}
            />
          )}
        </Grid>
      }
      icon={{
        type: 'standard',
        icon: 'screen',
      }}
      nestedBorder
      css={css`
        max-width: 33rem;
      `}
      actions={
        sessions.length > 1 && (
          <DropDown dropDownClassName="slds-dropdown_actions" position="right" items={items} onSelected={handleMenuAction} />
        )
      }
    >
      {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}
      {isLoading && !currentSession && <Spinner />}
      {currentSession.map((session) => (
        <ProfileSessionItem
          key={session.sessionId}
          type="SESSION"
          sessionId={session.sessionId}
          createdAt={session.loginTime}
          expiresAt={session.expires}
          ipAddress={session.ipAddress}
          provider={session.provider}
          userAgent={session.userAgent}
          location={session.location}
          isCurrentSession={session.sessionId === currentSessionId}
          onRevokeSession={revokeSession}
        />
      ))}
      {otherSessions.map((session) => (
        <ProfileSessionItem
          key={session.sessionId}
          type="SESSION"
          sessionId={session.sessionId}
          createdAt={session.loginTime}
          expiresAt={session.expires}
          ipAddress={session.ipAddress}
          provider={session.provider}
          userAgent={session.userAgent}
          location={session.location}
          isCurrentSession={session.sessionId === currentSessionId}
          onRevokeSession={revokeSession}
        />
      ))}
      {webTokenSessions.map((session) => (
        <ProfileSessionItem
          key={session.id}
          type="EXTERNAL_SESSION"
          sessionId={session.id}
          createdAt={session.createdAt}
          expiresAt={session.expiresAt}
          ipAddress={session.ipAddress}
          source={session.source}
          userAgent={session.userAgent}
          location={session.location}
          onRevokeSession={revokeSession}
        />
      ))}
    </Card>
  );
};
