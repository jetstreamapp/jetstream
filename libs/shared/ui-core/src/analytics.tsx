/// <reference types="vite/client" />
import * as amplitude from '@amplitude/analytics-browser';
import { logger } from '@jetstream/shared/client-logger';
import { ApplicationCookie } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import isBoolean from 'lodash/isBoolean';
import { useEffect } from 'react';

const amplitudeToken = import.meta.env.NX_PUBLIC_AMPLITUDE_KEY;

let hasInit = false;
let hasProfileInit = false;

function init(appCookie: ApplicationCookie, version: string) {
  hasInit = true;
  if (!amplitudeToken) {
    return;
  }
  amplitude.init(amplitudeToken, {
    serverUrl: `${appCookie.serverUrl}/analytics`,
    appVersion: version || 'unknown',
    autocapture: {
      attribution: true,
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
  });
}

export function useAmplitude(optOut?: boolean) {
  const appCookie = useAtomValue(fromAppState.applicationCookieState);
  const userProfile = useAtomValue(fromAppState.userProfileState);
  const { version } = useAtomValue(fromAppState.appVersionState);
  const userPreferences = useAtomValue(fromAppState.selectUserPreferenceState);

  useEffect(() => {
    if (isBoolean(optOut)) {
      if (optOut) {
        amplitude.setOptOut(true);
      } else {
        amplitude.setOptOut(false);
      }
    }
  }, [optOut]);

  useEffect(() => {
    if (!hasInit && appCookie) {
      init(appCookie, version);
    }
  }, [appCookie, version]);

  useEffect(() => {
    if (!amplitudeToken) {
      return;
    }
    if (!hasProfileInit && userProfile && appCookie) {
      hasProfileInit = true;
      const identify = new amplitude.Identify()
        .set('id', userProfile.id)
        .set('email-verified', userProfile.emailVerified)
        .set('environment', appCookie.environment)
        .add('app-init-count', 1)
        .set('application-type', 'web');

      if (userPreferences.deniedNotifications) {
        identify.set('denied-notifications', userPreferences.deniedNotifications);
      }

      amplitude.identify(identify);
      amplitude.setUserId(userProfile.id);
    }
  }, [userProfile, appCookie, userPreferences]);

  return {
    trackEvent: track,
    project: amplitude,
  };
}

export function track(key: string, value?: Record<string, any>) {
  try {
    if (!amplitudeToken) {
      return;
    }
    amplitude.track(key, value);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}
