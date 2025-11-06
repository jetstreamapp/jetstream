/// <reference types="vite/client" />
import * as amplitude from '@amplitude/analytics-browser';
import { logger } from '@jetstream/shared/client-logger';
import { ApplicationState } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import isBoolean from 'lodash/isBoolean';
import { useEffect } from 'react';

const amplitudeToken = import.meta.env.NX_PUBLIC_AMPLITUDE_KEY;

let hasInit = false;
let hasProfileInit = false;

function init(appState: ApplicationState, version: string) {
  hasInit = true;
  if (!amplitudeToken) {
    return;
  }
  amplitude.init(amplitudeToken, {
    serverUrl: `${appState.serverUrl}/analytics`,
    appVersion: version || 'unknown',
    defaultTracking: {
      attribution: true,
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
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
  const { appInfo, version } = useAtomValue(fromAppState.appInfoState);
  const userProfile = useAtomValue(fromAppState.userProfileState);
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
    if (!hasInit && appInfo && !optOut) {
      init(appInfo, version);
    }
  }, [appInfo, optOut, version]);

  useEffect(() => {
    if (!amplitudeToken) {
      return;
    }
    if (!hasProfileInit && userProfile && appInfo) {
      hasProfileInit = true;
      const identify = new amplitude.Identify()
        .set('id', userProfile.id)
        .set('email-verified', userProfile.emailVerified)
        .set('environment', appInfo.environment)
        .add('app-init-count', 1)
        .set('application-type', 'web');

      if (userPreferences.deniedNotifications) {
        identify.set('denied-notifications', userPreferences.deniedNotifications);
      }

      amplitude.identify(identify);
      amplitude.setUserId(userProfile.id);
    }
  }, [userProfile, appInfo, userPreferences]);

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
