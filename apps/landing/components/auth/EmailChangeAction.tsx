import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useEffect, useState } from 'react';
import { ROUTES, SIGN_IN_ERRORS } from '../../utils/environment';
import { ErrorQueryParamErrorBanner } from '../ErrorQueryParamErrorBanner';

type EmailChangeActionType = 'confirm' | 'cancel';

const COPY: Record<EmailChangeActionType, { heading: string; body: string; submitLabel: string; pendingLabel: string }> = {
  confirm: {
    heading: 'Confirm your new email address',
    body: 'Confirming will make this the email address you sign in with. You will be signed out everywhere, including the desktop app and browser extension.',
    submitLabel: 'Confirm email change',
    pendingLabel: 'Confirming...',
  },
  cancel: {
    heading: 'Cancel this email change',
    body: 'Cancelling will leave your email address exactly as it is. If you did not start this request, cancel it and then reset your password - someone else may have access to your account.',
    submitLabel: 'Cancel email change',
    pendingLabel: 'Cancelling...',
  },
};

interface EmailChangeActionProps {
  action: EmailChangeActionType;
  csrfToken: string;
  token: string;
}

/**
 * Interstitial for the confirm/cancel links emailed during an address change.
 *
 * The page only renders on load - the mutation is a POST behind an explicit click. Mail scanners and
 * link prefetchers follow URLs in email (and some execute JavaScript), so auto-submitting here would
 * let them silently complete or kill a change the user never saw.
 */
export function EmailChangeAction({ action, csrfToken, token }: EmailChangeActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [newEmail, setNewEmail] = useState<string | null>(null);

  const copy = COPY[action];

  // Drop the token from the visible URL once it is held in memory, so it does not linger in browser
  // history or get captured in a screen share. The referrer policy set by the page keeps it out of
  // outbound Referer headers.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has('code')) {
      url.searchParams.delete('code');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const url = action === 'confirm' ? ROUTES.AUTH.api_email_change_confirm : ROUTES.AUTH.api_email_change_cancel;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: new URLSearchParams({ csrfToken, token }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      // Rate-limit responses do not share the standard error body shape.
      if (response.status === 429) {
        router.push(`${router.pathname}?${new URLSearchParams({ error: 'TooManyRequests' })}`);
        return;
      }

      const responseData: { data?: { error?: boolean; errorType?: string; email?: string }; errorType?: string } = await response
        .json()
        .catch(() => ({}));
      const errorType = (responseData.errorType || responseData.data?.errorType) as keyof typeof SIGN_IN_ERRORS | undefined;

      if (!response.ok || responseData.data?.error) {
        router.push(`${router.pathname}?${new URLSearchParams({ error: errorType || 'InvalidOrExpiredEmailChangeToken' })}`);
        return;
      }

      setNewEmail(responseData.data?.email ?? null);
      setIsComplete(true);
    } catch {
      router.push(`${router.pathname}?${new URLSearchParams({ error: 'Unknown' })}`);
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">{copy.heading}</h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          {isComplete ? (
            <div className="space-y-6 text-center">
              {action === 'confirm' ? (
                <Fragment>
                  <p className="text-sm text-gray-700">
                    Your email address was changed{newEmail ? ` to ${newEmail}` : ''}. Sign in with your new address to continue.
                  </p>
                  <p className="text-sm text-gray-500">
                    You have been signed out everywhere, including the desktop app and browser extension.
                  </p>
                </Fragment>
              ) : (
                <p className="text-sm text-gray-700">
                  The request was cancelled and your email address is unchanged. If you did not start it, reset your password now.
                </p>
              )}
              <Link
                href={ROUTES.AUTH.login}
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} method="POST" noValidate className="space-y-6">
              <p className="text-sm text-gray-700">{copy.body}</p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? copy.pendingLabel : copy.submitLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </Fragment>
  );
}
