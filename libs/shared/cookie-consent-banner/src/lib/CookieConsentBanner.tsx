import { CSSProperties, useId } from 'react';
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
  const headingId = useId();
  const detailsId = useId();

  if (!showBanner) {
    return null;
  }

  return (
    <div style={containerStyles}>
      {/* A named region so screen readers announce what the banner is when it appears or is reached,
          and buttons that say what they accept/reject on their own — "Accept" alone gave no context. */}
      <section className={styles.banner} aria-labelledby={headingId}>
        <div className={styles.container}>
          <div className={styles.content}>
            <p id={headingId} className={styles.text}>
              We use cookies to improve your experience
            </p>
            <p id={detailsId} className={styles.details}>
              We use analytics cookies to understand how you use our application.{' '}
              <a href={privacyPolicyUrl} className={styles.link} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} onClick={rejectAll} type="button" aria-describedby={detailsId}>
              Reject cookies
            </button>
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={acceptAll} type="button" aria-describedby={detailsId}>
              Accept cookies
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CookieConsentBanner;
