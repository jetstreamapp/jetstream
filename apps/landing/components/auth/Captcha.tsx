import { useId } from 'react';
import Turnstile from 'react-turnstile';
import { ENVIRONMENT } from '../../utils/environment';

interface CaptchaProps {
  action: string;
  formError?: string;
  onChange: (token: string) => void;
}

export function Captcha({ action, formError, onChange }: CaptchaProps) {
  const id = useId();

  // Skip rendering the captcha if we're running in Playwright or if the key is not set
  // In real environments the server will still validate and prevent access if there isn't a valid token
  if (!ENVIRONMENT.CAPTCHA_KEY || (window as any)?.playwright) {
    return null;
  }

  return (
    <>
      <Turnstile
        id={id}
        sitekey={ENVIRONMENT.CAPTCHA_KEY}
        theme="light"
        appearance="always"
        size="flexible"
        refreshExpired="auto"
        fixedSize
        action={action}
        onVerify={(token) => onChange(token)}
        // onError={}
        onSuccess={(token, preClearanceObtained) => onChange(token)}
      />
      {formError && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {formError}
        </p>
      )}
    </>
  );
}
