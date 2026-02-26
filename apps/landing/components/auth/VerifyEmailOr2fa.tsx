import { zodResolver } from '@hookform/resolvers/zod';
import { TwoFactorType } from '@jetstream/auth/types';
import { Maybe } from '@jetstream/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { FormEvent, Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Checkbox } from '../form/Checkbox';
import { Input } from '../form/Input';

const FormSchema = z.object({
  csrfToken: z.string(),
  code: z.string().min(6).max(6),
  captchaToken: z.string(),
  type: z.enum(['email', '2fa-otp', '2fa-email']),
  rememberDevice: z.boolean().optional().default(false),
});

function getTitleText(authFactor: TwoFactorType, email?: Maybe<string>) {
  if (email) {
    const TITLE_TEXT: Record<TwoFactorType, string> = {
      email: `Verify your email address ${email}`,
      '2fa-email': `Enter verification code sent to ${email}`,
      '2fa-otp': 'Enter your verification code from your authenticator app',
    };
    return TITLE_TEXT[authFactor];
  }

  const TITLE_TEXT: Record<TwoFactorType, string> = {
    email: 'Verify your email address',
    '2fa-email': `Enter your verification sent to your email`,
    '2fa-otp': 'Enter your verification code from your authenticator app',
  };
  return TITLE_TEXT[authFactor];
}

type Form = z.infer<typeof FormSchema>;

interface VerifyEmailOr2faProps {
  csrfToken: string;
  email?: Maybe<string>;
  pendingVerifications: TwoFactorType[];
}

export function VerifyEmailOr2fa({ csrfToken, email, pendingVerifications }: VerifyEmailOr2faProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const [hasResent, setHasResent] = useState(false);

  const [activeFactor, setActiveFactor] = useState(pendingVerifications[0]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: searchParams?.get('code') || '',
      csrfToken,
      captchaToken: '',
      type: activeFactor,
      rememberDevice: true,
    },
  });

  const captchaToken = watch('captchaToken');

  const onSubmit = async (payload: Form) => {
    const response = await fetch(ROUTES.AUTH.api_verify, {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams({
        ...payload,
        rememberDevice: payload.rememberDevice ? 'true' : 'false',
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    // Rate limit responses use a different body shape than normal API errors
    if (response.status === 429) {
      setError('TooManyRequests');
      return;
    }

    const { error, errorType, redirect } = await response
      .json()
      .then((res: { data: { error: boolean; errorType?: string; redirect?: string } }) => res.data);

    if (!response.ok || error) {
      setError(errorType || 'UNKNOWN_ERROR');
      return;
    }

    if (redirect?.startsWith(ROUTES.AUTH._root_path)) {
      router.push(redirect);
      return;
    }

    window.location.href = redirect || ENVIRONMENT.CLIENT_URL;
  };

  const handleResendEmailVerification = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      const formData = new FormData(event.target as HTMLFormElement);
      const response = await fetch(ROUTES.AUTH.api_verify_resend, {
        method: 'POST',
        credentials: 'include',
        // FormData IS allowed here, but TS types are incorrect - https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: new URLSearchParams(formData as any).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }
      setHasResent(true);
    } catch {
      setError('UNKNOWN_ERROR');
    }
  };

  return (
    <Fragment>
      <ErrorQueryParamErrorBanner error={error} />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link href={ROUTES.HOME}>
            <img
              alt="Jetstream"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              className="mx-auto h-10 w-auto"
            />
          </Link>
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            {getTitleText(activeFactor, email)}
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit(onSubmit)} method="POST" noValidate className="space-y-6">
            <input type="hidden" {...register('csrfToken')} />
            <input type="hidden" {...register('type')} />
            <input type="hidden" {...register('captchaToken')} />

            <Input
              label="Verification Code"
              error={errors?.code?.message}
              inputProps={{
                type: 'text',
                required: true,
                autoComplete: 'one-time-code',
                spellCheck: false,
                inputMode: 'numeric',
                maxLength: 6,
                minLength: 6,
                pattern: '[0-9]{6}',
                ...register('code'),
              }}
            />

            {activeFactor !== 'email' && <Checkbox inputProps={{ ...register('rememberDevice') }}>Remember this device</Checkbox>}

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Continue
              </button>
            </div>
          </form>

          <ChangeAuthenticationMethod
            activeFactor={activeFactor}
            pendingVerifications={pendingVerifications}
            onChange={(type) => {
              setValue('type', type);
              setActiveFactor(type);
            }}
          />

          <div className="mt-10">
            {!hasResent && activeFactor !== '2fa-otp' && (
              <form onSubmit={handleResendEmailVerification} method="POST" className="space-y-6">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="captchaToken" value={captchaToken} />
                <input type="hidden" name="type" value={activeFactor} />

                <p className="text-center text-sm text-gray-500">
                  Need a new code?{' '}
                  <button type="submit" className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
                    Send a new code
                  </button>
                </p>
              </form>
            )}

            <p className="text-center text-sm text-gray-500">
              Need to start over?{' '}
              <a href={ROUTES.AUTH.api_logout} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
                Logout
              </a>
            </p>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

function ChangeAuthenticationMethod({
  activeFactor,
  pendingVerifications,
  onChange,
}: {
  activeFactor: TwoFactorType;
  pendingVerifications: TwoFactorType[];
  onChange: (type: TwoFactorType) => void;
}) {
  const secondaryFactor = pendingVerifications.find((factor) => factor !== 'email' && factor !== activeFactor);

  if (activeFactor === 'email' || secondaryFactor === 'email' || !secondaryFactor) {
    return null;
  }

  if (activeFactor === '2fa-otp') {
    return (
      <p className="mt-3 text-sm text-gray-500">
        <button className="font-semibold leading-6 text-blue-600 hover:text-blue-700" onClick={() => onChange(secondaryFactor)}>
          Verify using email
        </button>
      </p>
    );
  }

  if (activeFactor === '2fa-email') {
    return (
      <p className="mt-3 text-sm text-gray-500">
        <button className="font-semibold leading-6 text-blue-600 hover:text-blue-700" onClick={() => onChange(secondaryFactor)}>
          Verify using authenticator app
        </button>
      </p>
    );
  }

  return null;
}
