import { css } from '@emotion/react';
import { UserSessionWithLocation } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { getUserSessions, revokeAllUserSessions, revokeUserSession } from '@jetstream/shared/data';
import { DropDownItem } from '@jetstream/types';
import { Card, ConfirmationModalPromise, DropDown, fireToast, ScopedNotification, Spinner } from '@jetstream/ui';
import partition from 'lodash/partition';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProfileSessionItem } from './ProfileSessionItem';

const items: DropDownItem[] = [
  {
    id: 'revoke-all',
    value: 'Revoke All Other Sessions',
    icon: { type: 'utility', icon: 'delete', description: 'Delete' },
  },
];

export const ProfileSessions = () => {
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [sessions, setSessions] = useState<UserSessionWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>();

  const [currentSession, otherSessions] = useMemo(() => {
    return partition(sessions, (session) => session.sessionId === currentSessionId);
  }, [currentSessionId, sessions]);

  const getSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await getUserSessions();
      setCurrentSessionId(response.currentSessionId);
      setSessions(response.sessions);
    } catch (ex) {
      logger.error('Failed to get sessions', ex);
      setErrorMessage('Failed to get sessions, please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getSessions();
  }, [getSessions]);

  async function handleRevokeSession(sessionId: string) {
    try {
      if (
        await ConfirmationModalPromise({
          content: 'Are you sure you want to revoke this session?',
        })
      ) {
        setIsLoading(true);
        const response = await revokeUserSession(sessionId, 'SESSION');
        setCurrentSessionId(response.currentSessionId);
        setSessions(response.sessions);
      }
    } catch (ex) {
      logger.error('Failed to revoke session', ex);
      fireToast({ message: 'There was an error revoking your sessions, try again later.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMenuAction(action: string) {
    try {
      if (action === 'revoke-all') {
        if (
          await ConfirmationModalPromise({
            content: 'Are you sure you want to revoke all sessions?',
          })
        ) {
          setIsLoading(true);
          const response = await revokeAllUserSessions(currentSessionId);
          setCurrentSessionId(response.currentSessionId);
          setSessions(response.sessions);
        }
      }
    } catch (ex) {
      logger.error('Failed to revoke sessions', ex);
      fireToast({ message: 'There was an error revoking your sessions, try again later.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card
      className="slds-is-relative"
      bodyClassName={null}
      title="Sessions"
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
      {isLoading && <Spinner />}
      {currentSession.map((session) => (
        <ProfileSessionItem
          key={session.sessionId}
          session={session}
          isCurrentSession={session.sessionId === currentSessionId}
          onRevokeSession={handleRevokeSession}
        />
      ))}
      {otherSessions.map((session) => (
        <ProfileSessionItem
          key={session.sessionId}
          session={session}
          isCurrentSession={session.sessionId === currentSessionId}
          onRevokeSession={handleRevokeSession}
        />
      ))}
    </Card>
  );
};
