import { InformationCircleIcon } from '@heroicons/react/20/solid';

interface SsoAvailableBannerProps {
  isStartingSso: boolean;
  onLogin: () => void;
}

/** Shown when SSO was discovered from the email address the user typed in */
export function SsoAvailableBanner({ isStartingSso, onLogin }: SsoAvailableBannerProps) {
  return (
    <div className="rounded-md bg-blue-50 p-4">
      <div className="flex">
        <div className="shrink-0">
          <InformationCircleIcon aria-hidden="true" className="h-5 w-5 text-blue-400" />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-blue-700">Single Sign-On is available</p>
          <p className="mt-3 text-sm md:ml-6 md:mt-0">
            <button
              type="button"
              onClick={onLogin}
              disabled={isStartingSso}
              autoFocus
              data-testid="sso-available-login-button"
              className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-600 disabled:text-blue-400"
            >
              Log in with SSO <span aria-hidden="true">&rarr;</span>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
