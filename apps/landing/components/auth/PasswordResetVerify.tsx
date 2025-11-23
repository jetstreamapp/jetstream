import { zodResolver } from '@hookform/resolvers/zod';
import { containsUserInfo } from '@jetstream/shared/utils';
import { PasswordSchema } from '@jetstream/types';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ROUTES, SIGN_IN_ERRORS } from '../../utils/environment';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Input } from '../form/Input';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { ShowPasswordButton } from './ShowPasswordButton';

const FormSchema = z
  .object({
    csrfToken: z.string(),
    captchaToken: z.string(),
    token: z.string(),
    email: z.string(),
    password: PasswordSchema,
    confirmPassword: PasswordSchema,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    } else if (containsUserInfo(data.password, data.email)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password cannot contain your name or email address',
        path: ['password'],
      });
    }
  });

type Form = z.infer<typeof FormSchema>;

interface PasswordResetVerifyProps {
  csrfToken: string;
  email: string;
  token: string;
}

export function PasswordResetVerify({ csrfToken, email, token }: PasswordResetVerifyProps) {
  const router = useRouter();
  const [showPasswordActive, setShowPasswordActive] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email,
      token,
      password: '',
      confirmPassword: '',
      csrfToken,
      captchaToken: '',
    },
  });

  const watchPassword = watch('password');
  const watchConfirmPassword = watch('confirmPassword');
  const watchEmail = watch('email');

  const onSubmit = async (payload: Form) => {
    const response = await fetch(ROUTES.AUTH.api_reset_password_verify, {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams(payload).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });
    const responseData: {
      data: {
        error: boolean;
        errorType?: string;
        redirect?: string;
      };
    } = await response.json();

    const error = responseData.data.error;
    const errorType = responseData.data.errorType as keyof typeof SIGN_IN_ERRORS | undefined;

    if (!response.ok || error) {
      // Error banner will show specific error message based on query param - let user try again
      if (errorType === 'PasswordReused') {
        router.push(`${router.pathname}?${new URLSearchParams({ ...router.query, error: errorType || 'Unknown' })}`);
        return;
      }

      router.push(`${router.pathname}?${new URLSearchParams({ error: errorType || 'Unknown' })}`);
      return;
    }

    router.push(`${ROUTES.AUTH.login}?${new URLSearchParams({ email, success: 'Login with your new password to continue' })}`);
  };

  // TODO: should user be required to confirm 2fa at this point, or just on the next login?

  return (
    <Fragment>
      <ErrorQueryParamErrorBanner />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link href={ROUTES.HOME}>
            <img
              alt="Jetstream"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              className="mx-auto h-10 w-auto"
            />
          </Link>
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Reset Password</h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit(onSubmit)} method="POST" noValidate className="space-y-6">
            <input type="hidden" {...register('csrfToken')} />
            <input type="hidden" {...register('captchaToken')} />
            <input hidden readOnly {...register('email')} autoComplete="username" />
            <input type="hidden" {...register('token')} />

            <Input
              label="New Password"
              error={errors?.password?.message}
              inputProps={{
                type: showPasswordActive ? 'text' : 'password',
                required: true,
                autoComplete: 'new-password',
                spellCheck: 'false',
                minLength: 8,
                maxLength: 255,
                ...register('password'),
              }}
            />

            <Input
              label="Confirm Password"
              error={errors?.confirmPassword?.message}
              inputProps={{
                type: showPasswordActive ? 'text' : 'password',
                required: true,
                autoComplete: 'new-password',
                minLength: 8,
                maxLength: 255,
                ...register('confirmPassword'),
              }}
            >
              <div className="flex items-center justify-end">
                <ShowPasswordButton isActive={showPasswordActive} onClick={() => setShowPasswordActive(!showPasswordActive)} />
              </div>
            </Input>

            {watchPassword && (
              <PasswordStrengthIndicator password={watchPassword} confirmPassword={watchConfirmPassword} email={watchEmail} />
            )}

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Submit
              </button>
            </div>
          </form>
          <p className="mt-10 text-center text-sm text-gray-500">
            <Link href={ROUTES.AUTH.login} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
              Go to Login Page
            </Link>
          </p>
        </div>
      </div>
    </Fragment>
  );
}
