import { RadioButton, RadioGroup } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useCookieConsent } from '@jetstream/ui/cookie-consent-banner';
import { useAtom } from 'jotai';

type ConsentValue = 'accepted' | 'rejected' | null;

export const AnalyticsTrackingSetting = () => {
  const { acceptAll, rejectAll } = useCookieConsent();
  const [analytics, setAnalytics] = useAtom(fromAppState.analyticsState);

  function handleChange(value: ConsentValue) {
    setAnalytics(value);
    if (value === 'accepted') {
      acceptAll();
    } else {
      rejectAll();
    }
  }

  return (
    <RadioGroup label="Analytics Tracking" isButtonGroup>
      <RadioButton
        id="cookie-consent-accept"
        name="cookie-analytics-consent"
        label="Allow"
        value="accepted"
        checked={analytics === 'accepted'}
        onChange={(value) => handleChange(value as ConsentValue)}
      />
      <RadioButton
        id="cookie-consent-reject"
        name="cookie-analytics-consent"
        label="Disallow"
        value="rejected"
        checked={analytics !== 'accepted'}
        onChange={(value) => handleChange(value as ConsentValue)}
      />
    </RadioGroup>
  );
};
