import { logger } from '@jetstream/shared/client-logger';
import { ApplicationCookie } from '@jetstream/types';
import amplitude, { Config } from 'amplitude-js';
import isBoolean from 'lodash/isBoolean';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import * as fromAppState from './app-shared.store';

interface Environment {
  amplitudeToken?: string;
  authAudience?: string;
}

let environment: Environment = {};

let hasInit = false;
let hasProfileInit = false;

const REMOVE_PROTO_REGEX = new RegExp('^http(s?)://');

function init(appCookie: ApplicationCookie, version: string, amplitudeToken?: string) {
  if (!amplitudeToken) {
    return;
  }
  hasInit = true;
  const config: Config | undefined = !(window as any).electron?.isElectron
    ? {
        apiEndpoint: `${appCookie.serverUrl.replace(REMOVE_PROTO_REGEX, '')}/analytics`,
        forceHttps: false,
      }
    : undefined;
  amplitude.getInstance().init(amplitudeToken, undefined, config);
  amplitude.getInstance().setVersionName(version);
}

export function useAmplitude(env?: Environment, optOut?: boolean) {
  const appCookie = useRecoilValue(fromAppState.applicationCookieState);
  const userProfile = useRecoilValue(fromAppState.userProfileState);
  const { version } = useRecoilValue(fromAppState.appVersionState);
  const userPreferences = useRecoilValue(fromAppState.selectUserPreferenceState);

  const amplitudeToken = environment?.amplitudeToken;

  useEffect(() => {
    if (env) {
      environment = env;
    }
  }, [env]);

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
    if (!hasInit && appCookie && environment) {
      init(appCookie, version, environment?.amplitudeToken);
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
        .add('application-type', (window as any).electron?.platform || 'web');

      if (userPreferences.deniedNotifications) {
        identify.set('denied-notifications', userPreferences.deniedNotifications);
      }

      if (userProfile && environment.authAudience) {
        identify.set('feature-flags', userProfile[environment.authAudience as 'http://getjetstream.app/app_metadata']?.featureFlags);
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
    if (!environment?.amplitudeToken) {
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
    if (!environment?.amplitudeToken) {
      return;
    }
    amplitude.getInstance().logEvent(key, value);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}
