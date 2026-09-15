import { getAuthErrorMessage, isLoginMethod, LoginMethod } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { useSearchParams } from 'next/navigation';
import Alert from './Alert';

interface ErrorQueryParamErrorBannerProps {
  /**
   * If provided, this will be used instead of checking the query params.
   */
  error?: Maybe<string>;
  message?: Maybe<string>;
  success?: Maybe<string>;
}

/** Sent alongside `error=ProviderNotAllowed` so the banner can name the methods the team permits */
function parseLoginMethods(value: Maybe<string>): LoginMethod[] {
  return (value?.split(',') ?? []).filter(isLoginMethod);
}

export function ErrorQueryParamErrorBanner({ error, message, success }: ErrorQueryParamErrorBannerProps) {
  const searchParams = useSearchParams();

  error = error ?? searchParams?.get('error');
  message = message ?? searchParams?.get('message');
  success = success ?? searchParams?.get('success');

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
