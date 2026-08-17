import type { Providers } from '@jetstream/auth/types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginOrSignUp } from '../components/auth/LoginOrSignUp';
import { setLastUsedLoginMethod } from '../utils/utils';

const searchParams = new URLSearchParams();

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), pathname: '/auth/login' }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const PROVIDERS = {
  google: { provider: 'google', signinUrl: 'https://example.com/signin/google', callbackUrl: 'https://example.com/callback/google' },
  salesforce: {
    provider: 'salesforce',
    signinUrl: 'https://example.com/signin/salesforce',
    callbackUrl: 'https://example.com/callback/salesforce',
  },
  credentials: { provider: 'credentials', signinUrl: 'https://example.com/signin', callbackUrl: 'https://example.com/callback' },
} as unknown as Providers;

const SSO_EMAIL = 'user@example.com';

function renderLoginForm(action: 'login' | 'register' = 'login') {
  return render(<LoginOrSignUp action={action} providers={PROVIDERS} csrfToken="csrf-token" currentTosVersion="2024-01-01" />);
}

function mockFetchJson(response: { ok: boolean; status?: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: () => Promise.resolve(response.body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getEmailInputValue() {
  return (screen.getByLabelText('Email Address') as HTMLInputElement).value;
}

describe('login form SSO experience', () => {
  beforeEach(() => {
    localStorage.clear();
    Array.from(searchParams.keys()).forEach((key) => searchParams.delete(key));
    // jsdom does not implement navigation, so the SSO redirect is swallowed instead of erroring
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, origin: 'https://example.com', href: '' } as Location);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('when the last login was SSO', () => {
    beforeEach(() => {
      setLastUsedLoginMethod({ lastUsedLogin: 'sso', rememberedEmail: SSO_EMAIL, ssoAvailable: true });
    });

    it('offers only the remembered SSO login and hides every other login option', () => {
      renderLoginForm();

      expect(screen.getByTestId('sso-last-used-login-button').textContent).toContain(SSO_EMAIL);
      expect(screen.getByTestId('use-another-login-method-button')).toBeTruthy();

      expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Salesforce/ })).toBeNull();
      expect(screen.queryByTestId('continue-with-sso-button')).toBeNull();
      expect(screen.queryByLabelText('Email Address')).toBeNull();
      expect(screen.queryByLabelText('Password')).toBeNull();
    });

    it('reveals all login options when another method is requested', async () => {
      renderLoginForm();

      await userEvent.click(screen.getByTestId('use-another-login-method-button'));

      expect(screen.getByRole('button', { name: /Google/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Salesforce/ })).toBeTruthy();
      expect(screen.getByTestId('continue-with-sso-button')).toBeTruthy();
      expect(getEmailInputValue()).toBe(SSO_EMAIL);
      expect(screen.queryByTestId('sso-last-used-login-button')).toBeNull();
    });

    it('keeps the other login options reachable when starting SSO fails', async () => {
      mockFetchJson({ ok: false, status: 400, body: { error: true, errorType: 'InvalidProvider' } });
      renderLoginForm();

      await userEvent.click(screen.getByTestId('sso-last-used-login-button'));

      await waitFor(() => expect(screen.getByText(/Single sign-on is not available/)).toBeTruthy());
      expect(screen.getByTestId('use-another-login-method-button')).toBeTruthy();
    });

    it('shows the full form instead when the login link is for a different email address', () => {
      searchParams.set('email', 'someone-else@example.com');

      renderLoginForm();

      expect(screen.queryByTestId('sso-last-used-login-button')).toBeNull();
      expect(getEmailInputValue()).toBe('someone-else@example.com');
    });

    it('shows the full form on the sign-up page', () => {
      renderLoginForm('register');

      expect(screen.queryByTestId('sso-last-used-login-button')).toBeNull();
      expect(screen.getByTestId('continue-with-sso-button')).toBeTruthy();
    });
  });

  describe('SSO grouped with the social login options', () => {
    it('collects only an email address after SSO is chosen', async () => {
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));

      expect(screen.getByTestId('sso-email-continue-button')).toBeTruthy();
      expect(screen.getByLabelText('Email Address')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    });

    it('returns to all login options from the SSO email step', async () => {
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));
      await userEvent.click(screen.getByTestId('back-to-all-login-options-button'));

      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
      expect(screen.queryByTestId('sso-email-continue-button')).toBeNull();
    });

    it('keeps focus on the email address across both view changes', async () => {
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));
      expect(document.activeElement).toBe(screen.getByLabelText('Email Address'));

      await userEvent.click(screen.getByTestId('back-to-all-login-options-button'));
      expect(document.activeElement).toBe(screen.getByLabelText('Email Address'));
    });

    it('starts SSO for the email address that was entered', async () => {
      const fetchMock = mockFetchJson({ ok: true, body: { data: { redirectUrl: 'https://idp.example.com/login' } } });
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));
      await userEvent.type(screen.getByLabelText('Email Address'), SSO_EMAIL);
      await userEvent.click(screen.getByTestId('sso-email-continue-button'));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/auth/sso/start');
      expect(JSON.parse(options.body)).toEqual({ email: SSO_EMAIL, csrfToken: 'csrf-token' });
    });

    it('reports when SSO is not configured for the email address', async () => {
      mockFetchJson({ ok: false, status: 400, body: { error: true, data: { errorType: 'InvalidProvider' } } });
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));
      await userEvent.type(screen.getByLabelText('Email Address'), SSO_EMAIL);
      await userEvent.click(screen.getByTestId('sso-email-continue-button'));

      await waitFor(() => expect(screen.getByText(/Single sign-on is not available/)).toBeTruthy());
      expect(screen.getByTestId('back-to-all-login-options-button')).toBeTruthy();
    });

    it('reports when SSO requests are rate limited', async () => {
      mockFetchJson({ ok: false, status: 429, body: {} });
      renderLoginForm();

      await userEvent.click(screen.getByTestId('continue-with-sso-button'));
      await userEvent.type(screen.getByLabelText('Email Address'), SSO_EMAIL);
      await userEvent.click(screen.getByTestId('sso-email-continue-button'));

      await waitFor(() => expect(screen.getByText(/Too many attempts/)).toBeTruthy());
    });
  });
});
