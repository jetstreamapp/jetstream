import { zodResolver } from '@hookform/resolvers/zod';
import type { Providers } from '@jetstream/auth/types';
import { containsUserInfo } from '@jetstream/shared/utils';
import { PASSWORD_MIN_LENGTH, PasswordSchema } from '@jetstream/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { Fragment, useEffect, useRef, useState } from 'react';
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

const SsoDiscoveryResponseSchema = z.object({
  data: z.object({
    available: z.boolean(),
  }),
});

type SsoDiscoveryResponse = z.infer<typeof SsoDiscoveryResponseSchema>;

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
  const [{ lastUsedLogin, rememberedEmail }] = useState(getLastUsedLoginMethod);
  const [ssoInfo, setSsoInfo] = useState<SsoDiscoveryResponse['data'] | null>(null);
  const [hasCheckedSso, setHasCheckedSso] = useState(false);
  const [checkingSso, setCheckingSso] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const captchaRef = useRef<{ reset: () => void }>(null);
  const searchParams = useSearchParams();

  const emailHint = searchParams?.get('email') || (action === 'login' ? rememberedEmail : null);
  const returnUrl = searchParams?.get('returnUrl');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    resetField,
    trigger,
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

  useEffect(() => {
    // Reset state when email changes
    setSsoInfo(null);
    setHasCheckedSso(false);
    setDiscoveryError(null);
    setFinishedCaptcha(false);
    resetField('password');
    resetField('confirmPassword');
  }, [watchEmail, resetField]);

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

    const error = responseData.error || responseData.data?.error;
    const errorType = responseData.errorType || responseData.data?.errorType;

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

  const checkSso = async (email: string): Promise<SsoDiscoveryResponse['data'] | null> => {
    if (!email || !email.includes('@')) {
      return null;
    }

    try {
      const response = await fetch(ROUTES.AUTH.api_sso_discover, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, csrfToken }),
      });

      if (!response.ok) {
        return null;
      }

      const { data } = await response.json().then((data) => SsoDiscoveryResponseSchema.parse(data));

      return response.ok && data.available ? data : null;
    } catch (error) {
      console.error('Error discovering SSO', error);
      return null;
    }
  };

  const handleContinue = async () => {
    const emailValid = await trigger('email');
    if (!emailValid) {
      return;
    }

    setCheckingSso(true);
    setDiscoveryError(null);
    const data = await checkSso(watchEmail);
    setSsoInfo(data);
    setHasCheckedSso(true);
    setCheckingSso(false);
    if (!data) {
      setDiscoveryError(null);
    }
  };

  const handleSsoLogin = async () => {
    if (!ssoInfo?.available) {
      return;
    }

    const url = new URL(ROUTES.AUTH.api_sso_start, window.location.origin);
    if (returnUrl) {
      url.searchParams.set('returnUrl', returnUrl);
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ csrfToken, email: watchEmail }),
    });

    if (!response.ok) {
      // TODO: show error to user
      return;
    }

    const {
      data: { redirectUrl },
    } = (await response.json()) as { data: { redirectUrl: string } };

    setLastUsedLoginMethod({
      lastUsedLogin: 'sso',
      rememberedEmail: watchEmail,
      ssoAvailable: ssoInfo?.available,
    });
    window.location.href = redirectUrl;
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
                onKeyDown: (e) => {
                  if (e.key === 'Enter' && !ssoInfo && !hasCheckedSso) {
                    e.preventDefault();
                    handleContinue();
                  }
                },
              }}
            />
            {checkingSso && <p className="text-sm text-gray-500">Checking for SSO…</p>}
            {discoveryError && <p className="text-sm text-red-600">{discoveryError}</p>}

            {ssoInfo?.available && (
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  {/* TODO: add a "last used" indicator on SSO */}
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-blue-700">Single Sign-On is available</p>
                    <p className="mt-3 text-sm md:ml-6 md:mt-0">
                      <button
                        type="button"
                        onClick={handleSsoLogin}
                        className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-600"
                        autoFocus={true}
                      >
                        Log in with SSO <span aria-hidden="true">&rarr;</span>
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!hasCheckedSso && (
              <button
                type="button"
                onClick={handleContinue}
                className="mt-4 flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={checkingSso}
              >
                Continue
              </button>
            )}

            {hasCheckedSso && (
              <>
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
                    autoFocus: !ssoInfo?.available,
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
              </>
            )}
          </form>

          <RegisterOrSignUpLink action={action} emailHint={emailHint} />
        </div>
      </div>
    </Fragment>
  );
}
