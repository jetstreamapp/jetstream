import { useCallback, useEffect, useState } from 'react';
import { ConsentValue, CookieOptions, getStoredConsent, setStoredConsent, clearStoredConsent } from './cookie-storage';

export interface CookieConsentState {
  analyticsConsent: ConsentValue;
  showBanner: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  resetConsent: () => void;
}

export interface UseCookieConsentOptions {
  /**
   * Optional callback when consent changes
   * Useful for saving preferences to database
   */
  onConsentChange?: (analytics: ConsentValue) => void | Promise<void>;
  
  /**
   * Cookie options (domain, maxAgeDays)
   */
  cookieOptions?: CookieOptions;
}

/**
 * Hook to manage cookie consent state
 * Returns current consent state and methods to update it
 * 
 * This hook can be used by parent apps to save preferences to the database
 * by passing an onConsentChange callback
 */
export function useCookieConsent(options?: UseCookieConsentOptions): CookieConsentState {
  const { onConsentChange, cookieOptions } = options || {};
  const [analyticsConsent, setAnalyticsConsent] = useState<ConsentValue>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Load stored consent on mount
  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setAnalyticsConsent(stored.analytics);
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
  }, []);

  const acceptAll = useCallback(async () => {
    setAnalyticsConsent('accepted');
    setStoredConsent('accepted', cookieOptions);
    setShowBanner(false);
    
    if (onConsentChange) {
      await onConsentChange('accepted');
    }
  }, [onConsentChange, cookieOptions]);

  const rejectAll = useCallback(async () => {
    setAnalyticsConsent('rejected');
    setStoredConsent('rejected', cookieOptions);
    setShowBanner(false);
    
    if (onConsentChange) {
      await onConsentChange('rejected');
    }
  }, [onConsentChange, cookieOptions]);

  const resetConsent = useCallback(() => {
    setAnalyticsConsent(null);
    clearStoredConsent(cookieOptions);
    setShowBanner(true);
  }, [cookieOptions]);

  return {
    analyticsConsent,
    showBanner,
    acceptAll,
    rejectAll,
    resetConsent,
  };
}
