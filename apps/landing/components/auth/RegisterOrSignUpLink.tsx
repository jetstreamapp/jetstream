import Link from 'next/link';
import React, { useMemo } from 'react';
import { ROUTES } from '../../utils/environment';

export function RegisterOrSignUpLink({ action }: { action: 'login' | 'register' }) {
  const url = useMemo(() => {
    let output = new URL(ROUTES.AUTH.login, window.location.origin);
    if (action === 'login') {
      output = new URL(ROUTES.AUTH.signup, window.location.origin);
    }
    return output;
  }, [action]);

  if (action === 'login') {
    return (
      <p className="mt-10 text-center text-sm text-gray-500">
        Need to register?{' '}
        <Link href={url} passHref className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
          Sign up
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-10 text-center text-sm text-gray-500">
      Already have an account?{' '}
      <Link href={url} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
        Login
      </Link>
    </p>
  );
}
