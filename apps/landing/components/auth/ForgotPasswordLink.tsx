import Link from 'next/link';
import { AUTH_PATHS } from '../../utils/environment';

export function ForgotPasswordLink() {
  return (
    <div className="text-sm leading-6">
      <Link href={AUTH_PATHS.resetPassword} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
        Forgot password?
      </Link>
    </div>
  );
}
