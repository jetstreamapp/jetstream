import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export function ForgotPasswordLink() {
  return (
    <div className="text-sm leading-6">
      <Link href={ROUTES.AUTH.resetPassword} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
        Forgot password?
      </Link>
    </div>
  );
}
