import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useCsrfToken } from '../../hooks/auth.hooks';
import { ROUTES, SIGN_IN_ERRORS } from '../../utils/environment';
import Alert from '../Alert';
import { EmailChangeAction } from './EmailChangeAction';

/**
 * Shared shell for the confirm and cancel pages reached from the emailed links. Both need the same
 * token capture, CSRF gate and referrer suppression, so it lives here once - the page files exist
 * only to pick a route and a title.
 *
 * This site is a static export (next.config.js `output: 'export'`), so the page is prerendered with
 * no query string and `router.query` stays empty until the client router reports isReady. The
 * content is therefore not mounted until then - reading the token any earlier always yields ''.
 */
export function EmailChangeActionWrapper({ action }: { action: 'confirm' | 'cancel' }) {
  const router = useRouter();

  if (!router.isReady) {
    return null;
  }

  return <EmailChangeActionContent action={action} />;
}

function EmailChangeActionContent({ action }: { action: 'confirm' | 'cancel' }) {
  const router = useRouter();
  const { csrfToken, csrfTokenError: error, isLoadingCsrfToken: isLoading } = useCsrfToken();

  /**
   * Captured once, on a mount that is guaranteed to see the query, and then held rather than
   * re-read. The URL stops carrying it almost immediately: EmailChangeAction strips `code` as soon
   * as it has it, and a failed submit replaces the query with `?error=` so the banner can render.
   */
  const [token] = useState(() => (typeof router.query.code === 'string' ? router.query.code : ''));

  useEffect(() => {
    if (isLoading || token) {
      return;
    }
    router.push(`${ROUTES.AUTH.login}?error=InvalidOrExpiredEmailChangeToken`);
  }, [token, isLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.default} />
      </div>
    );
  }

  if (isLoading || !csrfToken || !token) {
    return null;
  }

  return (
    <>
      <Head>
        {/* Keeps the token out of Referer headers on any outbound request from this page. */}
        <meta name="referrer" content="no-referrer" />
      </Head>
      <EmailChangeAction action={action} csrfToken={csrfToken} token={token} />
    </>
  );
}
