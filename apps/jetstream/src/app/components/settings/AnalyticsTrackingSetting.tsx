import { SettingsToggleRow } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useCookieConsent } from '@jetstream/ui/cookie-consent-banner';
import { useAtom } from 'jotai';

export const AnalyticsTrackingSetting = () => {
  const { acceptAll, rejectAll } = useCookieConsent();
  const [analytics, setAnalytics] = useAtom(fromAppState.analyticsState);

  function handleChange(allowAnalytics: boolean) {
    setAnalytics(allowAnalytics ? 'accepted' : 'rejected');
    if (allowAnalytics) {
      acceptAll();
    } else {
      rejectAll();
    }
  }

  return (
    <SettingsToggleRow
      id="setting-analytics"
      title="Share usage analytics"
      description="Allow analytics cookies that help us understand how Jetstream is used. This is the same choice as the cookie banner."
      checked={analytics === 'accepted'}
      onChange={handleChange}
    />
  );
};
