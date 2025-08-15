import { Maybe } from '@jetstream/types';
import { useSearchParams } from 'next/navigation';
import { SIGN_IN_ERRORS } from '../utils/environment';
import Alert from './Alert';

interface ErrorQueryParamErrorBannerProps {
  /**
   * If provided, this will be used instead of checking the query params.
   */
  error?: Maybe<string>;
  message?: Maybe<string>;
  success?: Maybe<string>;
}

export function ErrorQueryParamErrorBanner({ error, message, success }: ErrorQueryParamErrorBannerProps) {
  const params = useSearchParams();

  error = error ?? params.get('error');
  message = message ?? params.get('message');
  success = success ?? params.get('success');

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert dismissable type="error" message={SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.default} />
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
