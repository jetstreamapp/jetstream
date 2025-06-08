import { UserSessionAndExtTokensAndActivityWithLocation } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { getUserSessions, revokeAllUserSessions, revokeUserSession } from '@jetstream/shared/data';
import { ConfirmationModalPromise, fireToast } from '@jetstream/ui';
import { useCallback, useEffect, useState } from 'react';

export function useSessionData() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>();
  const [sessions, setSessions] = useState<UserSessionAndExtTokensAndActivityWithLocation>({
    currentSessionId: '',
    sessions: [],
    webTokenSessions: [],
    loginActivity: [],
  });

  const getSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await getUserSessions();
      setSessions(response);
    } catch (ex) {
      logger.error('Failed to get sessions', ex);
      setErrorMessage('Failed to get sessions, please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function revokeSession(sessionId: string, type: 'SESSION' | 'EXTERNAL_SESSION') {
    try {
      if (
        await ConfirmationModalPromise({
          content: 'Are you sure you want to revoke this session?',
        })
      ) {
        setIsLoading(true);
        const response = await revokeUserSession(sessionId, type);
        setSessions(response);
      }
    } catch (ex) {
      logger.error('Failed to revoke session', ex);
      fireToast({ message: 'There was an error revoking your sessions, try again later.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function revokeAllSessions() {
    try {
      if (
        await ConfirmationModalPromise({
          content: 'Are you sure you want to revoke all other sessions?',
        })
      ) {
        setIsLoading(true);
        const response = await revokeAllUserSessions(sessions.currentSessionId);
        setSessions(response);
      }
    } catch (ex) {
      logger.error('Failed to revoke session', ex);
      fireToast({ message: 'There was an error revoking your sessions, try again later.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    getSessions();
  }, [getSessions]);

  return {
    isLoading,
    errorMessage,
    sessions,
    getSessions,
    revokeSession,
    revokeAllSessions,
  };
}
