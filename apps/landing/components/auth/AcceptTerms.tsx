import Link from 'next/link';
import { useState } from 'react';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { Checkbox } from '../form/Checkbox';

interface AcceptTermsProps {
  csrfToken: string;
  currentTosVersion: string;
}

export function AcceptTerms({ csrfToken, currentTosVersion }: AcceptTermsProps) {
  const [tosChecked, setTosChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    window.location.href = ROUTES.AUTH.api_logout;
  };

  const handleAccept = async () => {
    if (!tosChecked || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(ROUTES.AUTH.api_accept_terms, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ csrfToken, tosVersion: currentTosVersion }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept terms');
      }

      const { data } = await response.json();
      window.location.href = data?.redirect || ENVIRONMENT.CLIENT_URL;
    } catch (ex) {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <Link href={ROUTES.HOME}>
          <img
            alt="Jetstream"
            src="https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-logo.svg"
            className="mx-auto h-10 w-auto"
          />
        </Link>
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Updated Terms of Service</h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm space-y-6">
        <p className="text-sm text-gray-600">
          Our Terms of Service and/or Privacy Policy have been updated. Please review and accept to continue using Jetstream.
        </p>

        <Checkbox
          inputProps={{
            checked: tosChecked,
            onChange: (e) => setTosChecked(e.target.checked),
          }}
        >
          I have read and agree to the{' '}
          <a href={ROUTES.TERMS_OF_SERVICE} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={ROUTES.PRIVACY} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500 underline">
            Privacy Policy
          </a>
        </Checkbox>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleAccept}
          disabled={!tosChecked || isSubmitting}
          className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {isSubmitting ? 'Saving…' : 'Accept and Continue'}
        </button>

        <p className="text-center text-sm text-gray-500">
          <button type="button" onClick={handleSignOut} className="underline hover:text-gray-700">
            Sign out instead
          </button>
        </p>
      </div>
    </div>
  );
}
