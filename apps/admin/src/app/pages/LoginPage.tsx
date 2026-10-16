import { ADMIN_LOGIN_ERROR_PARAM, ADMIN_LOGIN_PATH, AdminLoginErrorCode, AdminLoginErrorCodeSchema } from '@jetstream/admin/types';
import { useSearchParams } from 'react-router';
import { getSafeReturnTo } from '../api/admin-api-client';
import { buttonClassName } from '../components/Button';
import { Alert } from '../components/ErrorAlert';

const LOGIN_ERROR_MESSAGES: Record<AdminLoginErrorCode, string> = {
  NOT_ALLOWED: 'This account does not have access.',
  INVALID_STATE: 'The sign-in attempt expired or was started in another tab. Please try again.',
  SIGN_IN_FAILED: 'Sign-in failed. Please try again.',
  ACCESS_IDENTITY_MISMATCH: 'Sign in with the same Google account you used for Cloudflare Access.',
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));
  const parsedErrorCode = AdminLoginErrorCodeSchema.safeParse(searchParams.get(ADMIN_LOGIN_ERROR_PARAM));
  const errorMessage = parsedErrorCode.success ? LOGIN_ERROR_MESSAGES[parsedErrorCode.data] : null;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-6 text-lg font-semibold text-slate-900">Admin</h1>
        {errorMessage && (
          <div className="mb-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        )}
        <a href={`${ADMIN_LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`} className={buttonClassName('primary', 'md', 'w-full')}>
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
