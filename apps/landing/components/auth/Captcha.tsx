import { Maybe } from '@jetstream/types';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { useId } from 'react';
import { ENVIRONMENT } from '../../utils/environment';

interface CaptchaProps {
  ref: React.Ref<TurnstileInstance>;
  formError?: Maybe<string>;
  action: string;
  onLoad?: () => void;
}
export function isCaptchaRequired() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ENVIRONMENT.CAPTCHA_KEY && !(window as any)?.playwright;
}

export const Captcha = ({ action, formError, ref, onLoad }: CaptchaProps) => {
  const id = useId();

  // Skip rendering the captcha if we're running in Playwright or if the key is not set
  // In real environments the server will still validate and prevent access if there isn't a valid token
  if (!ENVIRONMENT.CAPTCHA_KEY || !isCaptchaRequired()) {
    return null;
  }

  return (
    <>
      <Turnstile
        id={id}
        ref={ref}
        siteKey={ENVIRONMENT.CAPTCHA_KEY}
        options={{
          action,
          theme: 'light',
          appearance: 'always',
          size: 'flexible',
          refreshExpired: 'auto',
          feedbackEnabled: true,
        }}
        onWidgetLoad={onLoad}
      />
      {formError && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {formError}
        </p>
      )}
    </>
  );
};
