import { zodResolver } from '@hookform/resolvers/zod';
import type { Providers } from '@jetstream/auth/types';
import { containsUserInfo } from '@jetstream/shared/utils';
import { PASSWORD_MIN_LENGTH, PasswordSchema } from '@jetstream/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { Fragment, useRef, useState } from 'react';
import { FieldErrors, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { getLastUsedLoginMethod, setLastUsedLoginMethod } from '../../utils/utils';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Checkbox } from '../form/Checkbox';
import { Input } from '../form/Input';
import { Captcha } from './Captcha';
import { ForgotPasswordLink } from './ForgotPasswordLink';
import { LoginOrSignUpOAuthButton } from './LoginOrSignUpOAuthButton';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { RegisterOrSignUpLink } from './RegisterOrSignUpLink';
import { ShowPasswordButton } from './ShowPasswordButton';

const LoginSchema = z.object({
  action: z.literal('login'),
  csrfToken: z.string(),
  captchaToken: z.string(),
  email: z
    .email({
      error: 'A valid email address is required',
    })
    .min(5)
    .max(255)
    .trim(),
  // Backwards compatibility for older passwords
  password: z.string().min(8, `Password must be at least 8 characters long`).max(255, `Password must be at most 255 characters`),
  rememberMe: z.boolean().optional().default(true),
});

const RegisterSchema = LoginSchema.omit({ action: true, password: true }).extend({
  action: z.literal('register'),
  name: z
    .string()
    .min(1, {
      error: 'Name is required',
    })
    .max(255, {
      error: 'Name must be at most 255 characters',
    }),
  password: PasswordSchema,
  confirmPassword: PasswordSchema,
});

const FormSchema = z.discriminatedUnion('action', [LoginSchema, RegisterSchema]).superRefine((data, ctx) => {
  if (data.action === 'register') {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    } else if (containsUserInfo(data.password, data.email, data.name)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password cannot contain your name or email address',
        path: ['password'],
      });
    }
  }
});

type RegisterForm = z.infer<typeof RegisterSchema>;
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
  const captchaRef = useRef<{ reset: () => void }>(null);
  const searchParams = useSearchParams();
  const [{ lastUsedLogin, rememberedEmail }] = useState(getLastUsedLoginMethod);

  const emailHint = searchParams?.get('email') || (action === 'login' ? rememberedEmail : null);
  const returnUrl = searchParams?.get('returnUrl');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      action,
      email: emailHint || '',
      name: '',
      password: '',
      confirmPassword: '',
      csrfToken,
      captchaToken: '',
      rememberMe: true,
    },
  });

  const watchPassword = watch('password');
  const watchConfirmPassword = watch('confirmPassword');
  const watchEmail = watch('email');

  const onSubmit = async (payload: Form) => {
    if (!providers) {
      return;
    }
    const url = new URL(providers.credentials.callbackUrl);
    if (returnUrl) {
      url.searchParams.set('returnUrl', returnUrl);
    }
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: new URLSearchParams(payload as any).toString(),
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
      try {
        captchaRef?.current?.reset();
      } catch (ex) {
        console.error('Error resetting captcha', ex);
      }
      return;
    }

    if (payload.rememberMe) {
      // For credential login, we don't show last used but we do populate the email address as the cue
      setLastUsedLoginMethod({ rememberedEmail: payload.email });
    }

    if (responseData.data.redirect?.startsWith(ROUTES.AUTH._root_path)) {
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

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="grid grid-cols-2 gap-4">
            <LoginOrSignUpOAuthButton
              action={action}
              provider={providers?.google}
              csrfToken={csrfToken}
              returnUrl={returnUrl}
              lastUsedLogin={lastUsedLogin}
              setLastUsed={setLastUsedLoginMethod}
            />

            <LoginOrSignUpOAuthButton
              action={action}
              provider={providers?.salesforce}
              csrfToken={csrfToken}
              returnUrl={returnUrl}
              lastUsedLogin={lastUsedLogin}
              setLastUsed={setLastUsedLoginMethod}
            />
          </div>

          <div>
            <div className="relative mt-10">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm font-medium leading-6">
                <span className="bg-white px-6 text-gray-900">or continue with</span>
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
                error={(errors as FieldErrors<RegisterForm>)?.name?.message}
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
                minLength: action === 'register' ? PASSWORD_MIN_LENGTH : 8,
                maxLength: 255,
                ...register('password'),
              }}
            >
              {action !== 'register' && (
                <div className="flex items-center justify-between">
                  <Checkbox inputProps={{ ...register('rememberMe') }}>Remember Me</Checkbox>
                  <ShowPasswordButton isActive={showPasswordActive} onClick={() => setShowPasswordActive(!showPasswordActive)} />
                </div>
              )}
            </Input>

            {action === 'register' && (
              <Input
                label="Confirm Password"
                error={(errors as FieldErrors<RegisterForm>)?.confirmPassword?.message}
                inputProps={{
                  type: showPasswordActive ? 'text' : 'password',
                  required: true,
                  autoComplete: 'new-password',
                  minLength: PASSWORD_MIN_LENGTH,
                  maxLength: 255,
                  ...register('confirmPassword'),
                }}
              >
                <div className="flex items-center justify-between">
                  <Checkbox inputProps={{ ...register('rememberMe') }}>Remember Me</Checkbox>
                  <ShowPasswordButton isActive={showPasswordActive} onClick={() => setShowPasswordActive(!showPasswordActive)} />
                </div>
              </Input>
            )}

            {action === 'register' && watchPassword && (
              <PasswordStrengthIndicator password={watchPassword} confirmPassword={watchConfirmPassword} email={watchEmail} />
            )}

            <div className="flex items-center justify-end">
              <ForgotPasswordLink />
            </div>

            <Captcha
              ref={captchaRef}
              formError={errors?.captchaToken?.message}
              action={action}
              onChange={(token) => setValue('captchaToken', token)}
              onStateChange={setFinishedCaptcha}
            />

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={!finishedCaptcha}
              >
                {action === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </form>

          <RegisterOrSignUpLink action={action} emailHint={emailHint} />
        </div>
      </div>
    </Fragment>
  );
}
