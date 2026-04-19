import { render, screen } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterOrSignUpLink } from '../components/auth/RegisterOrSignUpLink';
import { getLastUsedLoginMethod, setLastUsedLoginMethod } from '../utils/utils';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: URL | string; children: ReactNode }) => (
    <a href={href.toString()} {...props}>
      {children}
    </a>
  ),
}));

describe('auth storage privacy', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/auth/login/?email=private@example.com');
  });

  it('clears remembered email state when no remembered email is provided', () => {
    setLastUsedLoginMethod({ lastUsedLogin: 'google', rememberedEmail: 'private@example.com', ssoAvailable: true });

    expect(getLastUsedLoginMethod()).toEqual({
      lastUsedLogin: 'google',
      rememberedEmail: 'private@example.com',
      ssoAvailable: true,
    });

    setLastUsedLoginMethod();

    expect(getLastUsedLoginMethod()).toEqual({
      lastUsedLogin: null,
      rememberedEmail: null,
      ssoAvailable: false,
    });
  });

  it('does not propagate email addresses into the sign up link', () => {
    render(<RegisterOrSignUpLink action="login" />);

    expect(screen.getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe(`${window.location.origin}/auth/signup/`);
  });

  it('does not propagate email addresses into the login link', () => {
    render(<RegisterOrSignUpLink action="register" />);

    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe(`${window.location.origin}/auth/login/`);
  });
});
