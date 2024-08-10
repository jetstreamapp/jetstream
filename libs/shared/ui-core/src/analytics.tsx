/// <reference types="vite/client" />
import { logger } from '@jetstream/shared/client-logger';
import { ApplicationCookie } from '@jetstream/types';
import amplitude, { Config } from 'amplitude-js';
import isBoolean from 'lodash/isBoolean';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { fromAppState } from '.';

let amplitudeToken = '';
let authAudience = 'http://getjetstream.app/app_metadata';

try {
  amplitudeToken = import.meta.env.NX_PUBLIC_AMPLITUDE_KEY;
} catch (ex) {
  logger.warn('Amplitude key not found');
}

try {
  authAudience = import.meta.env.NX_PUBLIC_AUTH_AUDIENCE;
} catch (ex) {
  logger.warn('authAudience key not found');
}

let hasInit = false;
let hasProfileInit = false;

const REMOVE_PROTO_REGEX = new RegExp('^http(s?)://');

function init(appCookie: ApplicationCookie, version: string) {
  hasInit = true;
  if (!amplitudeToken) {
    return;
  }
  const config: Config | undefined = {
    apiEndpoint: `${appCookie.serverUrl.replace(REMOVE_PROTO_REGEX, '')}/analytics`,
    forceHttps: false,
  };
  amplitude.getInstance().init(amplitudeToken, undefined, config);
  amplitude.getInstance().setVersionName(version);
}

export function useAmplitude(optOut?: boolean) {
  const appCookie = useRecoilValue(fromAppState.applicationCookieState);
  const userProfile = useRecoilValue(fromAppState.userProfileState);
  const { version } = useRecoilValue(fromAppState.appVersionState);
  const userPreferences = useRecoilValue(fromAppState.selectUserPreferenceState);

  useEffect(() => {
    if (isBoolean(optOut)) {
      if (optOut) {
        amplitude.getInstance().setOptOut(true);
      } else {
        amplitude.getInstance().setOptOut(false);
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
        .set('id', userProfile.sub)
        .set('email', userProfile.email)
        .set('email-verified', userProfile.email_verified)
        .set('environment', appCookie.environment)
        .add('app-init-count', 1)
        .add('application-type', 'web');

      if (userPreferences.deniedNotifications) {
        identify.set('denied-notifications', userPreferences.deniedNotifications);
      }

      if (authAudience) {
        identify.set('feature-flags', (userProfile as any)[authAudience]?.featureFlags);
      }

      amplitude.getInstance().identify(identify);
      amplitude.getInstance().setUserId(userProfile.email);
    }
  }, [userProfile, appCookie, userPreferences]);

  return {
    trackEvent: track,
    project: amplitude.getInstance(),
  };
}

export function usePageViews() {
  const location = useLocation();
  React.useEffect(() => {
    if (!amplitudeToken) {
      return;
    }
    amplitude.getInstance().logEvent('page-view', { url: location.pathname });
  }, [location]);
}

/**
 *
 * @param key
 * @param value Object of any kind (NOT A PRIMITIVE)
 */
export function track(key: string, value?: unknown) {
  try {
    if (!amplitudeToken) {
      return;
    }
    amplitude.getInstance().logEvent(key, value);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}
