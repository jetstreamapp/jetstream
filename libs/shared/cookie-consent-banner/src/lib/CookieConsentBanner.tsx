import { CSSProperties } from 'react';
import styles from './cookie-consent-banner.module.css';
import { CookieOptions } from './cookie-storage';
import { useCookieConsent } from './useCookieConsent';

export interface CookieConsentBannerProps {
  cookieOptions?: CookieOptions;
  privacyPolicyUrl?: string;
  containerStyles?: CSSProperties;
  onConsentChange?: (analytics: 'accepted' | 'rejected' | null) => void | Promise<void>;
}

export function CookieConsentBanner({
  cookieOptions,
  privacyPolicyUrl = '/privacy',
  containerStyles,
  onConsentChange,
}: CookieConsentBannerProps) {
  const { showBanner, acceptAll, rejectAll } = useCookieConsent({ onConsentChange, cookieOptions });

  if (!showBanner) {
    return null;
  }

  return (
    <div style={containerStyles}>
      <div className={styles.banner}>
        <div className={styles.container}>
          <div className={styles.content}>
            <p className={styles.text}>We use cookies to improve your experience</p>
            <p className={styles.details}>
              We use analytics cookies to understand how you use our application.{' '}
              <a href={privacyPolicyUrl} className={styles.link} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} onClick={rejectAll} type="button">
              Reject
            </button>
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={acceptAll} type="button">
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
