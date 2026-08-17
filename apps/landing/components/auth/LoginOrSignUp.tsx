import { zodResolver } from '@hookform/resolvers/zod';
import type { Providers } from '@jetstream/auth/types';
import { containsUserInfo } from '@jetstream/shared/utils';
import { PASSWORD_MIN_LENGTH, PasswordSchema } from '@jetstream/types';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import classNames from 'classnames';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { FieldErrors, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSsoLogin } from '../../hooks/sso.hooks';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { getLastUsedLoginMethod, setLastUsedLoginMethod } from '../../utils/utils';
import Alert from '../Alert';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Checkbox } from '../form/Checkbox';
import { Input } from '../form/Input';
import { Captcha, isCaptchaRequired } from './Captcha';
import { ContinueWithSsoButton } from './ContinueWithSsoButton';
import { ForgotPasswordLink } from './ForgotPasswordLink';
import { LastUsedSsoLogin } from './LastUsedSsoLogin';
import { LoginOrSignUpHeader } from './LoginOrSignUpHeader';
import { LoginOrSignUpOAuthButton } from './LoginOrSignUpOAuthButton';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { RegisterOrSignUpLink } from './RegisterOrSignUpLink';
import { ShowPasswordButton } from './ShowPasswordButton';
import { SsoAvailableBanner } from './SsoAvailableBanner';
import { SsoEmailStep } from './SsoEmailStep';

const LoginSchema = z.object({
  action: z.literal('login'),
  csrfToken: z.string(),
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
  tosVersion: z.string(),
  tosAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service, Privacy Policy, and Data Processing Agreement to continue',
  }),
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

/**
 * `lastUsedSso` mirrors the returning SSO user experience - the only login method offered is the
 * one that worked last time. `ssoEmail` collects just an email address to resolve the identity
 * provider from, without the credential fields getting in the way.
 */
type LoginFormView = 'lastUsedSso' | 'default' | 'ssoEmail';

/**
 * Whether the email address has been checked for an SSO configuration. Only meaningful on the
 * `default` view - the other two views never run discovery.
 */
type SsoDiscoveryState = 'unchecked' | 'unavailable' | 'available';

/** Shared by the credentials form and the SSO email step so the field behaves the same in both */
const EMAIL_INPUT_PROPS = {
  type: 'email',
  required: true,
  autoComplete: 'email',
  spellCheck: 'false',
  autoCapitalize: 'off',
} as const;

/** Chrome shared by every view so switching views cannot change the page framing */
function LoginFormShell({ action, children }: { action: 'login' | 'register'; children: ReactNode }) {
  return (
    <Fragment>
      <ErrorQueryParamErrorBanner />
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <LoginOrSignUpHeader action={action} />
        {children}
      </div>
    </Fragment>
  );
}

interface LoginOrSignUpProps {
  action: 'login' | 'register';
  providers: Providers;
  csrfToken: string;
  currentTosVersion: string;
}

export function LoginOrSignUp({ action, providers, csrfToken, currentTosVersion }: LoginOrSignUpProps) {
  const router = useRouter();
  const [showPasswordActive, setShowPasswordActive] = useState(false);
  const [{ lastUsedLogin, rememberedEmail }] = useState(getLastUsedLoginMethod);
  const [ssoDiscovery, setSsoDiscovery] = useState<SsoDiscoveryState>('unchecked');

  const captchaRef = useRef<TurnstileInstance>(null);
  const isCheckingSsoRef = useRef(false);
  const searchParams = useSearchParams();

  const emailAddressHint = searchParams?.get('email');
  const emailHint = emailAddressHint || (action === 'login' ? rememberedEmail : null);
  const returnUrl = searchParams?.get('returnUrl');

  const { discoverSso, startSsoLogin, isCheckingSso, isStartingSso, ssoError, clearSsoError } = useSsoLogin({ csrfToken, returnUrl });

  // A login link for a specific email address takes priority over the remembered SSO login
  const [view, setView] = useState<LoginFormView>(() =>
    action === 'login' && lastUsedLogin === 'sso' && rememberedEmail && !emailAddressHint ? 'lastUsedSso' : 'default',
  );

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      action,
      email: emailHint || '',
      name: '',
      password: '',
      confirmPassword: '',
      csrfToken,
      rememberMe: true,
      tosVersion: currentTosVersion,
      tosAccepted: false,
    },
  });

  const watchPassword = watch('password');
  const watchConfirmPassword = watch('confirmPassword');
  const watchEmail = watch('email');

  useEffect(() => {
    // Reset state when email changes
    setSsoDiscovery('unchecked');
    clearSsoError();
    resetField('password');
    resetField('confirmPassword');
  }, [watchEmail, resetField, clearSsoError]);

  const onSubmit = async (payload: Form) => {
    try {
      if (!providers) {
        return;
      }
      const url = new URL(providers.credentials.callbackUrl);
      if (returnUrl) {
        url.searchParams.set('returnUrl', returnUrl);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = new URLSearchParams(payload as any);

      if (isCaptchaRequired() && captchaRef.current) {
        const captchaToken = await captchaRef.current.getResponsePromise();
        if (!captchaToken) {
          throw new Error('Captcha verification is required. Please complete the captcha challenge and try again.');
        }
        params.set('captchaToken', captchaToken);
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: params.toString(),
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
      } else {
        setLastUsedLoginMethod();
      }

      if (responseData.data.redirect?.startsWith(ROUTES.AUTH._root_path)) {
        router.push(responseData.data.redirect);
        return;
      }

      window.location.href = responseData.data.redirect || ENVIRONMENT.CLIENT_URL;
    } catch (ex) {
      console.error('Error during form submission', ex);
      router.push(`${router.pathname}?${new URLSearchParams({ error: 'UNKNOWN_ERROR' })}`);
      try {
        captchaRef?.current?.reset();
      } catch (ex) {
        console.error('Error resetting captcha', ex);
      }
    }
  };

  const handleContinue = async () => {
    // Both the Continue button and Enter on the email input land here, and validation is awaited
    // before discovery flips `isCheckingSso`, so a ref rather than that state is what keeps a second
    // press from firing a duplicate request against the rate limited discovery endpoint. Concurrent
    // calls would also let the first one to finish hide the "Checking for SSO" indicator early.
    if (isCheckingSsoRef.current) {
      return;
    }
    isCheckingSsoRef.current = true;

    try {
      const emailValid = await trigger('email');
      if (!emailValid) {
        return;
      }

      const checkedEmail = watchEmail;
      const isAvailable = await discoverSso(checkedEmail);

      // The email input stays editable while discovery is in flight, and changing it resets discovery.
      // Applying a result for an address the user has already moved on from would report SSO
      // availability for an address that was never checked.
      if (getValues('email') !== checkedEmail) {
        return;
      }

      setSsoDiscovery(isAvailable ? 'available' : 'unavailable');
    } finally {
      isCheckingSsoRef.current = false;
    }
  };

  /** SSO was explicitly requested, so the domain is resolved by starting the login rather than discovering first */
  const handleSsoEmailContinue = async () => {
    const emailValid = await trigger('email');
    if (!emailValid) {
      return;
    }

    await startSsoLogin(watchEmail);
  };

  // The button that was clicked is gone once the view changes, so focus lands on the email address -
  // the one input every view has. Each view renders its own tree, so the freshly mounted input's
  // `autoFocus` is what moves focus; focusing from here would target the input that is unmounting.
  const handleShowSsoEmailView = () => {
    clearSsoError();
    setView('ssoEmail');
  };

  const handleShowDefaultView = () => {
    clearSsoError();
    setView('default');
  };

  if (view === 'lastUsedSso' && rememberedEmail) {
    return (
      <LoginFormShell action={action}>
        <LastUsedSsoLogin
          email={rememberedEmail}
          isStartingSso={isStartingSso}
          error={ssoError}
          onLogin={() => startSsoLogin(rememberedEmail)}
          onUseAnotherMethod={handleShowDefaultView}
        />
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <RegisterOrSignUpLink action={action} emailHint={rememberedEmail} />
        </div>
      </LoginFormShell>
    );
  }

  if (view === 'ssoEmail') {
    return (
      <LoginFormShell action={action}>
        <SsoEmailStep
          isStartingSso={isStartingSso}
          error={ssoError}
          onContinue={handleSsoEmailContinue}
          onBack={handleShowDefaultView}
          emailInput={
            <Input
              label="Email Address"
              error={errors?.email?.message}
              inputProps={{
                ...EMAIL_INPUT_PROPS,
                autoFocus: true,
                ...register('email'),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  handleSsoEmailContinue();
                },
              }}
            />
          }
        />
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <RegisterOrSignUpLink action={action} emailHint={emailHint} />
        </div>
      </LoginFormShell>
    );
  }

  return (
    <LoginFormShell action={action}>
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

        <ContinueWithSsoButton isLastUsed={action === 'login' && lastUsedLogin === 'sso'} onClick={handleShowSsoEmailView} />

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

        <form action={providers?.credentials.callbackUrl} onSubmit={handleSubmit(onSubmit)} method="POST" noValidate className="space-y-6">
          <input type="hidden" {...register('csrfToken')} />
          <input type="hidden" {...register('action')} />
          {action === 'register' && <input type="hidden" {...register('tosVersion')} />}

          <Input
            label="Email Address"
            error={errors?.email?.message}
            inputProps={{
              ...EMAIL_INPUT_PROPS,
              autoFocus: true,
              ...register('email'),
              onKeyDown: (event) => {
                // Once discovery has run the form can submit normally
                if (event.key !== 'Enter' || ssoDiscovery !== 'unchecked') {
                  return;
                }
                event.preventDefault();
                handleContinue();
              },
            }}
          />
          {isCheckingSso && <p className="text-sm text-gray-500">Checking for SSO…</p>}
          {ssoError && <Alert type="error" message={ssoError} />}

          {ssoDiscovery === 'available' && <SsoAvailableBanner isStartingSso={isStartingSso} onLogin={() => startSsoLogin(watchEmail)} />}

          {ssoDiscovery === 'unchecked' && (
            <Fragment>
              <button
                type="button"
                onClick={handleContinue}
                className="mt-4 flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={isCheckingSso}
              >
                Continue
              </button>

              <RegisterOrSignUpLink action={action} emailHint={emailHint} />
            </Fragment>
          )}

          {/* We want the components to render in the DOM to allow for password auto-fill */}
          <span className={classNames('space-y-6', { invisible: ssoDiscovery === 'unchecked' })}>
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
                // Only once discovery has ruled SSO out, so it does not take focus from the email
                // address while the credential fields are still hidden
                autoFocus: ssoDiscovery === 'unavailable',
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

            {action === 'register' && (
              <div className="space-y-1">
                <Checkbox inputProps={{ ...register('tosAccepted') }}>
                  I agree to the{' '}
                  <a
                    href={ROUTES.TERMS_OF_SERVICE}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-500 underline"
                  >
                    Terms of Service
                  </a>
                  ,{' '}
                  <a href={ROUTES.PRIVACY} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500 underline">
                    Privacy Policy
                  </a>
                  , and{' '}
                  <a href={ROUTES.DPA} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500 underline">
                    Data Processing Agreement
                  </a>
                </Checkbox>
                {(errors as FieldErrors<RegisterForm>)?.tosAccepted && (
                  <p className="text-sm text-red-600">{(errors as FieldErrors<RegisterForm>).tosAccepted?.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end">
              <ForgotPasswordLink />
            </div>

            <Captcha ref={captchaRef} action={action} />

            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              disabled={ssoDiscovery === 'unchecked' || isSubmitting}
            >
              {action === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          </span>
        </form>

        {ssoDiscovery !== 'unchecked' && <RegisterOrSignUpLink action={action} emailHint={emailHint} />}
      </div>
    </LoginFormShell>
  );
}
