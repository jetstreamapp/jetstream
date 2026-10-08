import { getAuthErrorMessage, isLoginMethod, LoginMethod } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { useSearchParams } from 'next/navigation';
import Alert from './Alert';

interface ErrorQueryParamErrorBannerProps {
  /**
   * If provided, this will be used instead of checking the query params.
   */
  error?: Maybe<string>;
  /** Only ever set by a caller - free text is never read from the URL, see SUCCESS_MESSAGES */
  message?: Maybe<string>;
  success?: Maybe<string>;
}

/**
 * The `success` query parameter is a key into this table, never text to display. These pages sit on the
 * real Jetstream origin, so rendering whatever a link put in the URL would let anyone craft a link that
 * shows their own "notice" inside the genuine login page.
 */
export const SUCCESS_MESSAGES = {
  'password-reset': 'Login with your new password to continue',
} as const;

export type SuccessMessageKey = keyof typeof SUCCESS_MESSAGES;

function getSuccessMessage(key: Maybe<string>): string | null {
  // Own properties only: `in` also matches inherited names, so `?success=__proto__` would hand an object to the Alert
  return key && Object.hasOwn(SUCCESS_MESSAGES, key) ? SUCCESS_MESSAGES[key as SuccessMessageKey] : null;
}

/** Sent alongside `error=ProviderNotAllowed` so the banner can name the methods the team permits */
function parseLoginMethods(value: Maybe<string>): LoginMethod[] {
  return (value?.split(',') ?? []).filter(isLoginMethod);
}

export function ErrorQueryParamErrorBanner({ error, message, success }: ErrorQueryParamErrorBannerProps) {
  const searchParams = useSearchParams();

  error = error ?? searchParams?.get('error');
  success = success ?? getSuccessMessage(searchParams?.get('success'));

  if (error) {
    const attemptedMethodParam = searchParams?.get('attemptedMethod');
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert
          dismissable
          type="error"
          message={getAuthErrorMessage(error, {
            attemptedMethod: isLoginMethod(attemptedMethodParam) ? attemptedMethodParam : undefined,
            allowedMethods: parseLoginMethods(searchParams?.get('allowedMethods')),
          })}
        />
      </div>
    );
  }

  if (message) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert dismissable type="info" message={message} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert dismissable type="success" message={success} />
      </div>
    );
  }

  return null;
}
