import { sanitizeUrlForTelemetry } from '@jetstream/shared/utils';
import { useEffect } from 'react';
import { getStoredConsent } from './cookie-storage';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Hook to manage Google Analytics based on consent
 * Only initializes GA if user has accepted analytics cookies
 *
 * Usage: Call this in your root component after consent banner is shown
 *
 * "currentConsent" can be passed in to trigger a change in consent to ensure that google analytics is loaded if required
 */
export function useConditionalGoogleAnalytics(gaId: string, currentConsent?: boolean) {
  useEffect(() => {
    try {
      if (!gaId) {
        return;
      }
      const consent = getStoredConsent();

      // Don't initialize if no consent or if rejected
      if (!consent || consent.analytics !== 'accepted') {
        // Disable GA if it was previously loaded
        updateGoogleAnalyticsConsent(false);
        return;
      }

      // User has accepted - initialize or enable GA
      if (window.gtag) {
        updateGoogleAnalyticsConsent(true);
      } else {
        loadGoogleAnalyticsIfRequired(gaId);
      }
    } catch (ex) {
      console.error('Error initializing Google Analytics with consent:', ex);
    }
  }, [gaId, currentConsent]);
}

/**
 * Manually update Google Analytics consent
 * Useful when consent changes after initial load
 */
export function loadGoogleAnalyticsIfRequired(gaId: string) {
  if (!window.gtag && gaId) {
    // Load GA script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      window.dataLayer!.push(args);
    };

    window.gtag('set', 'anonymizeIp', true);
    window.gtag('js', new Date());
    // Page views are sent manually with a sanitized location so query strings and path tokens
    // (password reset codes, invitation tokens, oauth code/state, ...) never reach Google.
    // page_location/page_referrer are also pinned on the config as a fallback for any
    // automatically collected event.
    window.gtag('config', gaId, {
      send_page_view: false,
      ...getSanitizedPageParams(),
    });
    sendSanitizedPageView();
    trackHistoryChanges();
  }
}

function getSanitizedPageParams(): { page_location: string; page_path: string; page_referrer?: string } {
  const referrer = sanitizeUrlForTelemetry(document.referrer);
  return {
    page_location: sanitizeUrlForTelemetry(window.location.href),
    page_path: sanitizeUrlForTelemetry(window.location.pathname),
    ...(referrer ? { page_referrer: referrer } : {}),
  };
}

let lastTrackedPathname: string | undefined;

/**
 * Send a GA4 page_view for the current location with the query string and secret path segments removed.
 * No-op when the pathname has not changed since the last page view (e.g. history.replaceState used to strip a query param).
 */
export function sendSanitizedPageView() {
  if (!window.gtag || window.location.pathname === lastTrackedPathname) {
    return;
  }
  lastTrackedPathname = window.location.pathname;
  window.gtag('event', 'page_view', getSanitizedPageParams());
}

let historyTrackingInstalled = false;

/**
 * Report SPA navigations (pushState/replaceState/popstate) as sanitized page views, once per document.
 */
function trackHistoryChanges() {
  if (historyTrackingInstalled) {
    return;
  }
  historyTrackingInstalled = true;
  const wrapHistoryMethod = (methodName: 'pushState' | 'replaceState') => {
    const original = window.history[methodName];
    window.history[methodName] = function wrappedHistoryMethod(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      sendSanitizedPageView();
      return result;
    };
  };
  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');
  window.addEventListener('popstate', () => sendSanitizedPageView());
}

/**
 * Manually update Google Analytics consent
 * Useful when consent changes after initial load
 */
export function updateGoogleAnalyticsConsent(granted: boolean) {
  if (window.gtag) {
    const value = granted ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_user_data: value,
      ad_personalization: value,
      ad_storage: value,
      analytics_storage: value,
    });
  }
}
