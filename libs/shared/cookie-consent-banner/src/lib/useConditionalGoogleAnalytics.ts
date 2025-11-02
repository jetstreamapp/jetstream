import { useEffect } from 'react';
import { getStoredConsent } from './cookie-storage';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Hook to manage Google Analytics based on consent
 * Only initializes GA if user has accepted analytics cookies
 *
 * Usage: Call this in your root component after consent banner is shown
 *
 * consent can be passed in to trigger a change in concent to ensure that google analytics is loaded if required
 */
export function useConditionalGoogleAnalytics(gaId: string, consent?: boolean) {
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
  }, [gaId, consent]);
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
    window.gtag('config', gaId);
  }
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
