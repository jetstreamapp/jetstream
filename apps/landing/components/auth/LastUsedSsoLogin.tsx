import { ArrowRightIcon, LockClosedIcon } from '@heroicons/react/20/solid';
import { Maybe } from '@jetstream/types';
import Alert from '../Alert';
import { LastUsedBadge } from './LastUsedBadge';

interface LastUsedSsoLoginProps {
  email: string;
  isStartingSso: boolean;
  error?: Maybe<string>;
  onLogin: () => void;
  onUseAnotherMethod: () => void;
}

/**
 * Shown instead of the full login form when the last successful login on this device was SSO.
 * Every other login method is one click away, but is kept out of the way until asked for.
 */
export function LastUsedSsoLogin({ email, isStartingSso, error, onLogin, onUseAnotherMethod }: LastUsedSsoLoginProps) {
  return (
    <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      {error && (
        <div className="mb-6">
          <Alert type="error" message={error} />
        </div>
      )}

      <button
        type="button"
        onClick={onLogin}
        disabled={isStartingSso}
        autoFocus
        data-testid="sso-last-used-login-button"
        className="flex w-full items-center justify-between gap-3 rounded-md bg-white px-4 py-3 text-left shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
      >
        <span className="flex min-w-0 items-center gap-3">
          <LockClosedIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500" />
          <span className="sr-only">Sign in with single sign-on as</span>
          <span className="truncate text-sm font-semibold leading-6 text-gray-900">{email}</span>
        </span>
        <LastUsedBadge className="shrink-0" />
      </button>

      {isStartingSso && <p className="mt-2 text-sm text-gray-500">Redirecting to your identity provider…</p>}

      <div className="relative mt-6">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm font-medium leading-6">
          <span className="bg-white px-6 text-gray-500">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onUseAnotherMethod}
        data-testid="use-another-login-method-button"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
      >
        Log in with another method
        <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
