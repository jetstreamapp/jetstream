import type { Provider, Providers } from '@jetstream/auth/types';
import classNames from 'classnames';
import { useMemo } from 'react';

interface LoginOrSignUpOAuthButtonProps {
  action: 'login' | 'register';
  provider: Provider;
  csrfToken: string;
  returnUrl: string | null;
  lastUsedLogin: keyof Providers | null;
  setLastUsed: (data: { lastUsedLogin?: keyof Providers | null; rememberedEmail?: string | null }) => void;
}

export function LoginOrSignUpOAuthButton({
  action,
  provider,
  csrfToken,
  returnUrl,
  lastUsedLogin,
  setLastUsed,
}: LoginOrSignUpOAuthButtonProps) {
  const { logo, label } = useMemo(() => {
    switch (provider.provider) {
      case 'google':
        return {
          logo: 'https://res.cloudinary.com/getjetstream/image/upload/v1693697889/public/google-login-icon_bzw1hi.svg',
          label: 'Google',
        };
      case 'salesforce':
        return {
          logo: 'https://res.cloudinary.com/getjetstream/image/upload/v1724511801/salesforce-blue_qdptxw.svg',
          label: 'Salesforce',
        };
      default:
        return {
          logo: '',
          label: provider.provider,
        };
    }
  }, [provider.provider]);

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
            'outline-blue-400 flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent',
            {
              'outline-2 outline-offset-2 outline': action === 'login' && lastUsedLogin === provider.provider,
            },
          )}
        >
          <img src={logo} alt={`${label} Logo`} className="h-5 w-5" />
          <span className="text-sm font-semibold leading-6">{label}</span>
        </button>
        {action === 'login' && lastUsedLogin === provider.provider && (
          <span className="mt-1 justify-center inline-flex items-center bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-400">
            Last Used
          </span>
        )}
      </div>
    </form>
  );
}
