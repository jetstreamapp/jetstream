import { Turnstile } from '@marsidev/react-turnstile';
import { useId } from 'react';
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

export function Captcha({ action, formError, onLoad, onChange, onFinished }: CaptchaProps) {
  const id = useId();

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
        siteKey={ENVIRONMENT.CAPTCHA_KEY}
        options={{
          action,
          theme: 'light',
          appearance: 'always',
          size: 'flexible',
          refreshExpired: 'auto',
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
}
