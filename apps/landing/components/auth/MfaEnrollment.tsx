/* eslint-disable @next/next/no-img-element */
import { zodResolver } from '@hookform/resolvers/zod';
import { OtpEnrollmentData } from '@jetstream/auth/types';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';
import { Input } from '../form/Input';

const FormSchema = z.object({
  csrfToken: z.string(),
  code: z.string().min(6).max(6),
  secretToken: z.string(),
  rememberDevice: z.boolean().optional().prefault(true),
});

type Form = z.infer<typeof FormSchema>;

interface MfaEnrollmentProps {
  csrfToken: string;
  otp2fa: OtpEnrollmentData;
  onSaveOtpFactor: (csrfToken: string, secretToken: string, code: string) => Promise<{ error: false; redirectUrl?: string }>;
}

export function MfaEnrollment({ csrfToken, otp2fa, onSaveOtpFactor }: MfaEnrollmentProps) {
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      csrfToken,
      secretToken: otp2fa.secretToken,
      code: '',
    },
  });

  const onSubmit = async (payload: Form) => {
    try {
      setError(undefined);
      const { redirectUrl } = await onSaveOtpFactor(payload.csrfToken, payload.secretToken, payload.code);

      window.location.href = redirectUrl || ENVIRONMENT.CLIENT_URL;
    } catch (error) {
      setError(error?.message ?? 'Unable to validate the code, please try again.');
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
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Enroll in MFA</h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit(onSubmit)} method="POST" noValidate className="space-y-6">
            <input type="hidden" {...register('csrfToken')} />

            <h5 className="text-center">Scan the QR code with your authenticator app</h5>
            <img src={otp2fa.imageUri} alt="qr code" className="justify-self-center" />
            <p className="text-center">Or enter the following secret in your authenticator app:</p>
            <div className="text-center" data-testid="totp-secret">
              {otp2fa.secretToken}
            </div>

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

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Continue
              </button>
            </div>

            <p className="text-center text-sm text-gray-500">
              Need to start over?{' '}
              <a href={ROUTES.AUTH.api_logout} className="font-semibold leading-6 text-blue-600 hover:text-blue-700">
                Logout
              </a>
            </p>
          </form>
        </div>
      </div>
    </Fragment>
  );
}
