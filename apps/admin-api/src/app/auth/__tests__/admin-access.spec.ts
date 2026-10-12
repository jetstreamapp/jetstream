import { evaluateAdminSignIn, sanitizeReturnTo } from '../admin-access';

const accessConfig = {
  allowedDomain: 'getjetstream.app',
  allowedEmails: new Set(['austin@getjetstream.app']),
};

const validClaims = {
  email: 'austin@getjetstream.app',
  email_verified: true,
  hd: 'getjetstream.app',
  name: 'Austin',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
};

describe('evaluateAdminSignIn', () => {
  it('allows a verified, allowlisted Workspace account', () => {
    expect(evaluateAdminSignIn(validClaims, accessConfig)).toEqual({
      allowed: true,
      user: { email: 'austin@getjetstream.app', name: 'Austin', picture: 'https://lh3.googleusercontent.com/photo.jpg' },
    });
  });

  it('normalizes the email before comparing it to the allowlist', () => {
    const decision = evaluateAdminSignIn({ ...validClaims, email: ' Austin@GetJetstream.app ' }, accessConfig);
    expect(decision.allowed).toBe(true);
  });

  it('rejects an unverified email', () => {
    expect(evaluateAdminSignIn({ ...validClaims, email_verified: false }, accessConfig).allowed).toBe(false);
    expect(evaluateAdminSignIn({ ...validClaims, email_verified: 'true' }, accessConfig).allowed).toBe(false);
  });

  it('rejects accounts outside the Workspace even when the address matches', () => {
    // A consumer Google account registered with a getjetstream.app address has no `hd` claim
    expect(evaluateAdminSignIn({ ...validClaims, hd: undefined }, accessConfig).allowed).toBe(false);
    expect(evaluateAdminSignIn({ ...validClaims, hd: 'example.com' }, accessConfig).allowed).toBe(false);
  });

  it('rejects a Workspace account that is not on the allowlist', () => {
    expect(evaluateAdminSignIn({ ...validClaims, email: 'someone@getjetstream.app' }, accessConfig).allowed).toBe(false);
  });

  it('rejects an address outside the domain even if hd matches', () => {
    const decision = evaluateAdminSignIn({ ...validClaims, email: 'austin@getjetstream.app.evil.com' }, accessConfig);
    expect(decision.allowed).toBe(false);
  });

  it('rejects missing or non-string emails', () => {
    expect(evaluateAdminSignIn({ ...validClaims, email: undefined }, accessConfig).allowed).toBe(false);
    expect(evaluateAdminSignIn({ ...validClaims, email: ['austin@getjetstream.app'] }, accessConfig).allowed).toBe(false);
  });
});

describe('sanitizeReturnTo', () => {
  it('keeps same-origin paths', () => {
    expect(sanitizeReturnTo('/teams/123?tab=billing')).toBe('/teams/123?tab=billing');
  });

  it.each([undefined, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'teams', '/auth/login', ['/teams']])(
    'falls back to / for %s',
    (returnTo) => {
      expect(sanitizeReturnTo(returnTo)).toBe('/');
    },
  );
});
