/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Alert from '../../../components/Alert';
import Layout from '../../../components/layouts/Layout';
import { useCsrfToken } from '../../../hooks/auth.hooks';
import { ROUTES } from '../../../utils/environment';

type VerifyInvitationResponse =
  | { success: true; authenticated: true; action: 'continue' }
  | { success: false; authenticated: false; action: 'redirect-to-login' }
  | { success: false; authenticated: true; action: 'error' }
  | { error: true; message: string; data: unknown };

async function verifyInvitation({ teamId, token }: { teamId: string; token: string }) {
  try {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    const response = await fetch(ROUTES.TEAM.verify_invitation({ teamId, token, returnUrl }), {
      headers: {
        Accept: 'application/json',
      },
    });
    const { data }: { data: VerifyInvitationResponse } = await response.json();
    if ('success' in data) {
      return data;
    }
    return { success: false, authenticated: false, action: 'error' };
  } catch (error) {
    return { success: false, authenticated: false, action: 'error' };
  }
}

async function acceptInvitation({ teamId, token, csrfToken }: { teamId: string; token: string; csrfToken: string }) {
  try {
    const response = await fetch(ROUTES.TEAM.accept_invitation({ teamId, token }), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ teamId, token, csrfToken }),
    });
    const { data }: { data: { success: true; redirectUrl: string } | { error: true; message: string; data: unknown } } =
      await response.json();
    if ('success' in data) {
      return data;
    }
    return { success: false, message: data.message } as const;
  } catch (error) {
    return { success: false, message: 'An error occurred while accepting the invitation.' } as const;
  }
}

export default function Page() {
  const router = useRouter();
  const { csrfToken, csrfTokenError } = useCsrfToken();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const [hasValidated, setHasValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  const teamId = searchParams.get('teamId');
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const teamName = searchParams.get('teamName') || 'a team';

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!teamId || !token) {
      setError('Your invitation link is invalid.');
      return;
    }

    verifyInvitation({ teamId, token })
      .then((response) => {
        if (response.success) {
          // Invitation is valid
          setHasValidated(true);
          return;
        }
        switch (response.action) {
          case 'redirect-to-login':
            router.push({ pathname: ROUTES.AUTH.login, query: { email, message: 'Login or register to accept your team invitation.' } });
            break;
          case 'error':
          default:
            setError('Your invitation link is invalid.');
            break;
        }
      })
      .catch((error) => {
        setError('Your invitation link is invalid.');
      });
  }, [email, router, teamId, token]);

  async function handleSubmit() {
    try {
      if (!teamId || !token || !csrfToken) {
        setError('Your invitation link is invalid or expired.');
        return;
      }
      setLoading(true);
      const results = await acceptInvitation({ teamId, token, csrfToken });
      if (results.success) {
        window.location.href = results.redirectUrl || '/app';
      } else {
        setError(results.message || 'An error occurred while accepting the invitation.');
      }
    } catch (error) {
      setError('An error occurred while accepting the invitation. Please try again later.');
      return;
    } finally {
      setLoading(false);
    }
  }

  if (error || csrfTokenError) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={error || csrfTokenError!} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert type="error" message={error} />
      </div>
    );
  }

  if (!hasValidated || !csrfToken || !teamId || !token) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Join {teamName}</h1>
        <p className="mt-2 text-lg text-gray-700">You've been invited to join {teamName} on Jetstream.</p>
      </div>
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <button
          className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          disabled={loading}
          type="submit"
          name="action"
          onClick={() => handleSubmit()}
        >
          <span className="mr-2">Accept Invitation</span>
          {/* {loading && <Spinner />} */}
        </button>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Join Team | Jetstream" omitFooter>
      {page}
    </Layout>
  );
};
