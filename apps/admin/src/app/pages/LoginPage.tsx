import { ADMIN_LOGIN_ERROR_PARAM, ADMIN_LOGIN_PATH, AdminLoginErrorCode, AdminLoginErrorCodeSchema } from '@jetstream/admin/types';
import { useSearchParams } from 'react-router';
import { getSafeReturnTo } from '../api/admin-api-client';
import { buttonClassName } from '../components/Button';
import { Alert } from '../components/ErrorAlert';

const LOGIN_ERROR_MESSAGES: Record<AdminLoginErrorCode, string> = {
  NOT_ALLOWED: 'That Google account is not allowed to use Jetstream Admin. Sign in with an allowlisted getjetstream.app account.',
  INVALID_STATE: 'The sign-in attempt expired or was started in another tab. Please try again.',
  SIGN_IN_FAILED: 'Google sign-in failed. Please try again.',
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));
  const parsedErrorCode = AdminLoginErrorCodeSchema.safeParse(searchParams.get(ADMIN_LOGIN_ERROR_PARAM));
  const errorMessage = parsedErrorCode.success ? LOGIN_ERROR_MESSAGES[parsedErrorCode.data] : null;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-2">
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">JS</span>
          <h1 className="text-lg font-semibold text-slate-900">Jetstream Admin</h1>
        </div>
        {errorMessage && (
          <div className="mb-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}
        <p className="mb-6 text-sm text-slate-600">Sign in with your getjetstream.app Google account.</p>
        <a href={`${ADMIN_LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`} className={buttonClassName('primary', 'md', 'w-full')}>
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
