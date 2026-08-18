import { LockClosedIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';
import { LastUsedBadge } from './LastUsedBadge';

interface ContinueWithSsoButtonProps {
  isLastUsed: boolean;
  onClick: () => void;
}

/**
 * Grouped with the social login buttons so SSO is discoverable before an email address is entered.
 * The email address is collected afterwards since the identity provider is resolved from its domain.
 */
export function ContinueWithSsoButton({ isLastUsed, onClick }: ContinueWithSsoButtonProps) {
  return (
    <div className="mt-4 flex flex-col">
      <button
        type="button"
        onClick={onClick}
        data-testid="continue-with-sso-button"
        className={classNames(
          'flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent',
          {
            'outline-2 outline-offset-2': isLastUsed,
          },
        )}
      >
        <LockClosedIcon aria-hidden="true" className="h-5 w-5 text-gray-500" />
        <span className="text-sm font-semibold leading-6">Continue with SSO</span>
      </button>
      {isLastUsed && <LastUsedBadge className="mt-1 justify-center" />}
    </div>
  );
}
