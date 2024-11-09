/* eslint-disable @next/next/no-img-element */
import { zodResolver } from '@hookform/resolvers/zod';
import { Providers } from '@jetstream/auth/types';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AUTH_PATHS, ENVIRONMENT } from '../../utils/environment';
import { PasswordSchema } from '../../utils/types';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Input } from '../form/Input';
import { Captcha } from './Captcha';
import { ForgotPasswordLink } from './ForgotPasswordLink';
import { RegisterOrSignUpLink } from './RegisterOrSignUpLink';
import { ShowPasswordButton } from './ShowPasswordButton';

const LoginSchema = z.object({
  action: z.literal('login'),
  csrfToken: z.string(),
  captchaToken: z.string(),
  email: z.string().email({ message: 'A valid email address is required' }).min(5).max(255).trim(),
  password: PasswordSchema,
});

const RegisterSchema = LoginSchema.omit({ action: true }).extend({
  action: z.literal('register'),
  name: z.string().min(1, { message: 'Name is required' }).max(255, { message: 'Name must be at most 255 characters' }),
  confirmPassword: PasswordSchema,
});

const FormSchema = z.discriminatedUnion('action', [LoginSchema, RegisterSchema]).superRefine((data, ctx) => {
  if (data.action === 'register') {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  }
});

type Form = z.infer<typeof FormSchema>;

interface LoginOrSignUpProps {
  action: 'login' | 'register';
  providers: Providers;
  csrfToken: string;
}

export function LoginOrSignUp({ action, providers, csrfToken }: LoginOrSignUpProps) {
  const router = useRouter();
  const [showPasswordActive, setShowPasswordActive] = useState(false);
  const [finishedCaptcha, setFinishedCaptcha] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      action,
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      csrfToken: csrfToken,
      captchaToken: '',
    },
  });

  const onSubmit = async (payload: Form) => {
    if (!providers) {
      return;
    }
    const response = await fetch(providers.credentials.callbackUrl, {
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams(payload).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });
    const responseData: {
      error?: boolean;
      errorType?: string;
      data: {
        error: boolean;
        errorType?: string;
        redirect?: string;
      };
    } = await response.json();

    const error = responseData.error || responseData.data.error;
    const errorType = responseData.errorType || responseData.data.errorType;

    if (!response.ok || error) {
      router.push(`${router.pathname}?${new URLSearchParams({ error: errorType || 'UNKNOWN_ERROR' })}`);
      return;
    }

    if (responseData.data.redirect?.startsWith(AUTH_PATHS._root_path)) {
      router.push(responseData.data.redirect);
      return;
    }

    window.location.href = responseData.data.redirect || ENVIRONMENT.CLIENT_URL;
  };

  return (
    <Fragment>
      <ErrorQueryParamErrorBanner />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link href="/">
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

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="grid grid-cols-2 gap-4">
            <form action={providers?.google.signinUrl} method="POST">
              <input type="hidden" name="csrfToken" value={csrfToken} />

              {providers?.google.callbackUrl && <input type="hidden" name="callbackUrl" value={providers?.google.callbackUrl} />}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent"
              >
                <img
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1693697889/public/google-login-icon_bzw1hi.svg"
                  alt="Google Logo"
                  className="h-5 w-5"
                />
                <span className="text-sm font-semibold leading-6">Google</span>
              </button>
            </form>
            <form action={providers?.salesforce.signinUrl} method="POST">
              <input type="hidden" name="csrfToken" value={csrfToken} />

              {providers?.salesforce.callbackUrl && <input type="hidden" name="callbackUrl" value={providers?.salesforce.callbackUrl} />}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent"
              >
                <img
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1724511801/salesforce-blue_qdptxw.svg"
                  alt="Salesforce Logo"
                  className="h-5 w-5"
                />
                <span className="text-sm font-semibold leading-6">Salesforce</span>
              </button>
            </form>
          </div>

          <div>
            <div className="relative mt-10">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm font-medium leading-6">
                <span className="bg-white px-6 text-gray-900">Or continue with</span>
              </div>
            </div>
          </div>

          <form
            action={providers?.credentials.callbackUrl}
            onSubmit={handleSubmit(onSubmit)}
            method="POST"
            noValidate
            className="space-y-6"
          >
            <input type="hidden" {...register('csrfToken')} />
            <input type="hidden" {...register('action')} />
            <input type="hidden" {...register('captchaToken')} />

            <Input
              label="Email Address"
              error={errors?.email?.message}
              inputProps={{
                type: 'email',
                autoFocus: true,
                required: true,
                autoComplete: 'email',
                spellCheck: 'false',
                autoCapitalize: 'off',
                ...register('email'),
              }}
            />

            {action === 'register' && (
              <Input
                label="Full Name"
                error={errors?.name?.message}
                inputProps={{
                  type: 'text',
                  required: true,
                  spellCheck: 'false',
                  autoComplete: 'name',
                  ...register('name'),
                }}
              />
            )}

            <Input
              label="Password"
              error={errors?.password?.message}
              inputProps={{
                type: showPasswordActive ? 'text' : 'password',
                required: true,
                autoComplete: action === 'login' ? 'current-password' : 'new-password',
                spellCheck: 'false',
                minLength: 8,
                maxLength: 255,
                ...register('password'),
              }}
            >
              {action !== 'register' && (
                <div className="flex items-center justify-end">
                  <ShowPasswordButton isActive={showPasswordActive} onClick={() => setShowPasswordActive(!showPasswordActive)} />
                </div>
              )}
            </Input>

            {action === 'register' && (
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
            )}

            <div className="flex items-center justify-end">
              <ForgotPasswordLink />
            </div>

            <Captcha
              formError={errors?.captchaToken?.message}
              action={action}
              onChange={(token) => setValue('captchaToken', token)}
              onFinished={() => setFinishedCaptcha(true)}
            />

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={!finishedCaptcha}
              >
                {action === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </form>

          <RegisterOrSignUpLink action={action} />
        </div>
      </div>
    </Fragment>
  );
}
