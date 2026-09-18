import type { Provider } from '@jetstream/auth/types';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import { useMemo } from 'react';
import type { LastUsedLoginMethod } from '../../utils/utils';
import { LastUsedBadge } from './LastUsedBadge';

interface LoginOrSignUpOAuthButtonProps {
  action: 'login' | 'register';
  provider: Provider;
  csrfToken: string;
  returnUrl?: Maybe<string>;
  lastUsedLogin: LastUsedLoginMethod | null;
  setLastUsed: (data: { lastUsedLogin?: LastUsedLoginMethod | null; rememberedEmail?: string | null }) => void;
}

export function LoginOrSignUpOAuthButton({
  action,
  provider,
  csrfToken,
  returnUrl,
  lastUsedLogin,
  setLastUsed,
}: LoginOrSignUpOAuthButtonProps) {
  const { icon, label } = provider;

  const actionUrl = useMemo(() => {
    if (!provider.signinUrl) {
      return undefined;
    }
    const url = new URL(provider.signinUrl);
    if (returnUrl) {
      url.searchParams.set('returnUrl', returnUrl);
    }
    return url.toString();
  }, [provider.signinUrl, returnUrl]);

  return (
    <form action={actionUrl} method="POST" onSubmit={() => setLastUsed({ lastUsedLogin: provider.provider })}>
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {provider.callbackUrl && <input type="hidden" name="callbackUrl" value={provider.callbackUrl} />}
      <div className="flex flex-col">
        <button
          type="submit"
          className={classNames(
            'flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent',
            {
              'outline-2 outline-offset-2': action === 'login' && lastUsedLogin === provider.provider,
            },
          )}
        >
          <img src={icon} alt={`Sign in with ${label} Logo`} className="h-5 w-5" />
          <span className="text-sm font-semibold leading-6">{label}</span>
        </button>
        {action === 'login' && lastUsedLogin === provider.provider && <LastUsedBadge className="mt-1 justify-center" />}
      </div>
    </form>
  );
}
