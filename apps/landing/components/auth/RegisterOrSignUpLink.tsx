import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export function RegisterOrSignUpLink({ action }: { action: 'login' | 'register' }) {
  if (action === 'login') {
    return (
      <p className="mt-10 text-center text-sm text-gray-500">
        Need to register?{' '}
        <Link href={ROUTES.AUTH.signup} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
          Sign up
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-10 text-center text-sm text-gray-500">
      Already have an account?{' '}
      <Link href={ROUTES.AUTH.login} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
        Login
      </Link>
    </p>
  );
}
