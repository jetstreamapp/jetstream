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
  onStateChange: (isFinished: boolean) => void;
}

// eslint-disable-next-line react/display-name
export const Captcha = forwardRef<{ reset: () => void }, CaptchaProps>(({ action, formError, onLoad, onChange, onStateChange }, ref) => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const id = useId();

  useImperativeHandle<unknown, { reset: () => void }>(
    ref,
    () => ({
      reset: () => {
        onStateChange(false);
        turnstileRef.current?.reset();
      },
    }),
    [onStateChange]
  );

  // Skip rendering the captcha if we're running in Playwright or if the key is not set
  // In real environments the server will still validate and prevent access if there isn't a valid token
  if (!ENVIRONMENT.CAPTCHA_KEY || (window as any)?.playwright) {
    onStateChange(true);
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
        onError={(error) => {
          console.error('Captcha error:', error);
          onStateChange(false);
        }}
        onSuccess={(token) => {
          onChange(token);
          onStateChange(true);
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
