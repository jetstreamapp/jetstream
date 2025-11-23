import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ROUTES } from '../../utils/environment';
import { PasswordSchema } from '../../utils/types';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Input } from '../form/Input';

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

  const {
    register,
    handleSubmit,
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
    const errorType = responseData.data.errorType;

    if (!response.ok || error) {
      router.push(`${router.pathname}?${new URLSearchParams({ error: errorType || 'UNKNOWN_ERROR' })}`);
      return;
    }

    router.push(`${ROUTES.AUTH.login}?${new URLSearchParams({ success: 'Login with your new password to continue' })}`);
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
                type: 'password',
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
                type: 'password',
                required: true,
                autoComplete: 'new-password',
                minLength: 8,
                maxLength: 255,
                ...register('confirmPassword'),
              }}
            />

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
