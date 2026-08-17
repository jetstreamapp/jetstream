import { LockClosedIcon } from '@heroicons/react/20/solid';
import { Maybe } from '@jetstream/types';
import { ReactNode } from 'react';
import Alert from '../Alert';

interface SsoEmailStepProps {
  /**
   * The email field, rendered by the parent so it stays bound to the same form instance as the
   * credentials view - switching between the two views keeps whatever the user already typed.
   */
  emailInput: ReactNode;
  isStartingSso: boolean;
  error?: Maybe<string>;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Collects just an email address to resolve the identity provider from. Deliberately rendered
 * instead of the credentials form rather than inside it, so there is no password field, captcha, or
 * submit path present on a screen that only ever redirects to an identity provider.
 */
export function SsoEmailStep({ emailInput, isStartingSso, error, onContinue, onBack }: SsoEmailStepProps) {
  return (
    <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <p className="mb-6 text-sm text-gray-600">
        Enter your email address and you will be redirected to your identity provider to sign in.
      </p>

      <div className="space-y-6">
        {emailInput}

        {error && <Alert type="error" message={error} />}

        <button
          type="button"
          onClick={onContinue}
          data-testid="sso-email-continue-button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          disabled={isStartingSso}
        >
          <LockClosedIcon aria-hidden="true" className="h-5 w-5" />
          Continue with SSO
        </button>

        <button
          type="button"
          onClick={onBack}
          data-testid="back-to-all-login-options-button"
          className="flex w-full items-center justify-center gap-1 text-sm font-semibold leading-6 text-blue-600 hover:text-blue-700"
        >
          <span aria-hidden="true">&larr;</span>
          Back to all sign in options
        </button>
      </div>
    </div>
  );
}
