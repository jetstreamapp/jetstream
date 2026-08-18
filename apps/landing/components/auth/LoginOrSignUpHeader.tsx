import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export function LoginOrSignUpHeader({ action }: { action: 'login' | 'register' }) {
  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-sm">
      <Link href={ROUTES.HOME}>
        <img
          alt="Jetstream"
          src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
          className="mx-auto h-10 w-auto"
        />
      </Link>
      <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
        {action === 'login' ? 'Sign in' : 'Sign up'}
      </h2>
    </div>
  );
}
