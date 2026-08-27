import { logger } from '@jetstream/shared/client-logger';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import isBoolean from 'lodash/isBoolean';
import { useEffect } from 'react';

export type BetterStackCommand =
  | ['init', { environment: string; release: string; autoPageview?: boolean; debug?: boolean }]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ['track', string, Record<string, any>?]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ['user', Record<string, any> | null];

/** The command-queue stub defined before the remote script loads; b.js drains `q` on load. */
export interface BetterStackTag {
  (...args: BetterStackCommand): void;
  q?: BetterStackCommand[];
  l?: number;
}

declare global {
  interface Window {
    betterstack?: BetterStackTag;
  }
}

let hasIdentified = false;
// Fail-closed: only AppInitializer flips this (via the optOut param) once the user
// accepts the cookie consent banner. Feature components call useAnalytics() with no
// argument and never change consent state.
let consentGranted = false;

/**
 * This module intentionally contains NO remote-script loading. Browser-extension stores reject
 * bundles that load remote code, and this file is bundled into every host app via shared feature
 * components. The Better Stack tag injection lives in the web app only (useAnalyticsTagLoader in
 * apps/jetstream); everywhere else `window.betterstack` never exists and every call here no-ops.
 */
export function useAnalytics(optOut?: boolean) {
  const { appInfo } = useAtomValue(fromAppState.appInfoState);
  const userProfile = useAtomValue(fromAppState.userProfileState);
  const userPreferences = useAtomValue(fromAppState.selectUserPreferenceState);

  useEffect(() => {
    if (isBoolean(optOut)) {
      const wasGranted = consentGranted;
      consentGranted = !optOut;
      if (wasGranted && optOut) {
        // Consent revoked mid-session: stop custom events immediately and drop the user
        // association. The already-loaded tag's automatic page views stop on the next
        // full page load, when the script is simply never loaded again.
        clearAnalyticsUser();
        hasIdentified = false;
      }
    }
  }, [optOut]);

  useEffect(() => {
    if (!consentGranted || !window.betterstack) {
      return;
    }
    if (!hasIdentified && userProfile && appInfo) {
      hasIdentified = true;
      // Intentionally no email/username - the user id is the only identifier sent.
      window.betterstack('user', {
        id: userProfile.id,
        email_verified: userProfile.emailVerified,
        application_type: 'web',
        ...(userPreferences.deniedNotifications ? { denied_notifications: userPreferences.deniedNotifications } : {}),
      });
    }
  }, [userProfile, appInfo, userPreferences, optOut]);

  return {
    trackEvent: track,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function track(key: string, value?: Record<string, any>) {
  try {
    if (!consentGranted || !window.betterstack) {
      return;
    }
    window.betterstack('track', key, value);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}

export function clearAnalyticsUser() {
  try {
    window.betterstack?.('user', null);
  } catch (ex) {
    logger.warn('[TRACKING ERROR]', ex);
  }
}
