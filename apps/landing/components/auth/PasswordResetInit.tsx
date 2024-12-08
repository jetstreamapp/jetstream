/* eslint-disable @next/next/no-img-element */
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AUTH_PATHS } from '../../utils/environment';
import Alert from '../Alert';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Input } from '../form/Input';
import { Captcha } from './Captcha';

const FormSchema = z.object({
  csrfToken: z.string(),
  captchaToken: z.string(),
  email: z.string().email({ message: 'A valid email address is required' }).min(5).max(255).trim(),
});

type Form = z.infer<typeof FormSchema>;

interface PasswordResetInitProps {
  csrfToken: string;
}

export function PasswordResetInit({ csrfToken }: PasswordResetInitProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finishedCaptcha, setFinishedCaptcha] = useState(false);
  const [error, setError] = useState<string>();
  const captchaRef = useRef<{ reset: () => void }>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: '',
      csrfToken: csrfToken,
      captchaToken: '',
    },
  });

  const onSubmit = async (payload: Form) => {
    try {
      setIsSaving(true);
      const response = await fetch(AUTH_PATHS.api_reset_password_init, {
        method: 'POST',
        credentials: 'include',
        body: new URLSearchParams(payload).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        try {
          captchaRef?.current?.reset();
        } catch (ex) {
          console.error('Error resetting captcha', ex);
        }
        throw new Error('Unable to initialize the reset process');
      }

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

      setIsSubmitted(true);
    } catch (error) {
      setError(error?.message ?? 'Unable to initialize the reset process');
    } finally {
      setIsSaving(true);
    }
  };

  return (
    <Fragment>
      <ErrorQueryParamErrorBanner error={error} />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link href="/">
            <img
              alt="Jetstream"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
              className="mx-auto h-10 w-auto"
            />
          </Link>
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Reset Password</h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          {isSubmitted && (
            <Alert
              message="You will receive an email with instructions if an account exists and is eligible for password reset. Contact support@getjetstream.app if you need further assistance."
              type="success"
            />
          )}
          {!isSubmitted && (
            <form onSubmit={handleSubmit(onSubmit)} method="POST" noValidate className="space-y-6">
              <input type="hidden" {...register('csrfToken')} />
              <input type="hidden" {...register('captchaToken')} />

              <Input
                label="Email Address"
                error={errors?.email?.message}
                inputProps={{
                  disabled: isSaving,
                  type: 'email',
                  autoFocus: true,
                  required: true,
                  autoComplete: 'email',
                  spellCheck: 'false',
                  autoCapitalize: 'off',
                  ...register('email'),
                }}
              />

              <Captcha
                ref={captchaRef}
                formError={errors?.captchaToken?.message}
                action="password-reset-init"
                onChange={(token) => setValue('captchaToken', token)}
                onStateChange={setFinishedCaptcha}
              />

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  disabled={isSaving || !finishedCaptcha}
                >
                  Submit
                </button>
              </div>
            </form>
          )}
          <p className="mt-10 text-center text-sm text-gray-500">
            <Link href={AUTH_PATHS.login} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
              Go to Login Page
            </Link>
          </p>
        </div>
      </div>
    </Fragment>
  );
}
