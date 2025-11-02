import styles from './cookie-consent-banner.module.css';
import { CookieOptions } from './cookie-storage';
import { useCookieConsent } from './useCookieConsent';

export interface CookieConsentBannerProps {
  cookieOptions?: CookieOptions;
  privacyPolicyUrl?: string;
  onConsentChange?: (analytics: 'accepted' | 'rejected' | null) => void | Promise<void>;
}

export function CookieConsentBanner({ cookieOptions, privacyPolicyUrl = '/privacy', onConsentChange }: CookieConsentBannerProps) {
  const { showBanner, acceptAll, rejectAll } = useCookieConsent({ onConsentChange, cookieOptions });

  if (!showBanner) {
    return null;
  }

  return (
    <div className={styles['banner-container']}>
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
