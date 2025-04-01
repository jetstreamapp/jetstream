import { logBuffer, logger } from '@jetstream/shared/client-logger';
import { ApplicationCookie, UserProfileUi } from '@jetstream/types';
import * as Sentry from '@sentry/react';
import { useCallback, useEffect, useMemo } from 'react';

const sentryDsn = import.meta.env.NX_PUBLIC_SENTRY_DSN;

let hasInit = false;
let hasProfileInit = false;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    ignoreErrors: ['expired access/refresh token', 'socket hang up'],
    integrations: [
      Sentry.feedbackIntegration({
        colorScheme: 'system',
        showName: false,
        showEmail: false,
        triggerLabel: '',
        formTitle: 'Give Feedback',
        messagePlaceholder: 'Report an issue or give feedback',
        submitButtonLabel: 'Submit',
      }),
    ],
  });
}

const getRecentLogs = () => {
  try {
    return JSON.stringify(logBuffer);
  } catch (ex) {
    return JSON.stringify([`ERROR GETTING RECENT LOGS: ${ex.message}`]);
  }
};

function init(appCookie: ApplicationCookie, version: string) {
  hasInit = true;
  if (!sentryDsn) {
    return;
  }
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      ignoreErrors: ['expired access/refresh token', 'socket hang up'],
      release: version,
      environment: appCookie.environment,
      attachStacktrace: true,
      integrations: [
        Sentry.feedbackIntegration({
          colorScheme: 'system',
          showName: false,
          showEmail: false,
          triggerLabel: '',
          formTitle: 'Give Feedback',
          messagePlaceholder: 'Report an issue or give feedback',
          submitButtonLabel: 'Submit',
        }),
      ],
    });
  }
}

export function useSentry(
  appState: {
    appCookie?: ApplicationCookie;
    userProfile?: UserProfileUi;
    version?: string;
  } = {}
) {
  const { appCookie, userProfile, version } = appState;

  useEffect(() => {
    if (!hasInit && appCookie) {
      init(appCookie, version || 'unknown');
    }
  }, [appCookie, version]);

  useEffect(() => {
    if (!sentryDsn) {
      return;
    }
    if (!hasProfileInit && userProfile && appCookie) {
      hasProfileInit = true;
      const { id, name, email } = userProfile;
      Sentry.setUser({ id, name, email });
    }
  }, [userProfile, appCookie]);

  const trackError = useCallback((message: string, error: unknown, location: string, extra?: Record<string, unknown>) => {
    logErrorToSentry(message, error, location, extra);
  }, []);

  const trackMessage = useCallback((message: string, location: string, extra?: Record<string, unknown>) => {
    logMessageToSentry(message, location, extra);
  }, []);

  return useMemo(() => ({ trackError, trackMessage }), [trackError, trackMessage]);
}

export function logErrorToSentry(message: string, error: unknown, location: string, extra: Record<string, unknown> = {}) {
  try {
    if (!sentryDsn) {
      return;
    }
    Sentry.captureException(error, {
      extra: { message, recentLogs: getRecentLogs(), ...extra },
      tags: { location },
    });
  } catch (ex) {
    logger.log('[SENTRY] Error logging to sentry', ex);
  }
}

export function logMessageToSentry(message: string, location: string, extra: Record<string, unknown> = {}) {
  try {
    if (!sentryDsn) {
      return;
    }
    Sentry.captureMessage(message, {
      extra: { message, recentLogs: getRecentLogs(), ...extra },
      tags: { location },
    });
  } catch (ex) {
    logger.log('[SENTRY] Error logging to sentry', ex);
  }
}
