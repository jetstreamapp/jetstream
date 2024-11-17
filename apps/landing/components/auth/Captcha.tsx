import { Maybe } from '@jetstream/types';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import { ENVIRONMENT } from '../../utils/environment';

interface CaptchaProps {
  formError?: string;
  action: string;
  onLoad?: () => void;
  /**
   * Called once captcha has been successfully completed
   */
  onChange: (token: string) => void;
  /**
   * Called once captcha has been successfully completed
   * Called immediately if captcha is disabled
   */
  onFinished: () => void;
}

// eslint-disable-next-line react/display-name
export const Captcha = forwardRef<Maybe<TurnstileInstance>, CaptchaProps>(({ action, formError, onLoad, onChange, onFinished }, ref) => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const id = useId();

  useImperativeHandle<unknown, Maybe<TurnstileInstance>>(ref, () => turnstileRef.current, [turnstileRef]);

  // Skip rendering the captcha if we're running in Playwright or if the key is not set
  // In real environments the server will still validate and prevent access if there isn't a valid token
  if (!ENVIRONMENT.CAPTCHA_KEY || (window as any)?.playwright) {
    onFinished();
    return null;
  }

  return (
    <>
      <Turnstile
        id={id}
        ref={turnstileRef}
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
        onSuccess={(token) => {
          onChange(token);
          onFinished();
        }}
      />
      {formError && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {formError}
        </p>
      )}
    </>
  );
});
