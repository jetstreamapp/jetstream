import { SsoRequirementConfig } from '@jetstream/shared/utils';
import { describe, expect, it } from 'vitest';
import { getSsoInviteWarning } from '../team-member-invite.utils';

const SSO_REQUIRED_FOR_MEMBERS: SsoRequirementConfig = {
  ssoEnabled: true,
  ssoProvider: 'SAML',
  ssoBypassEnabled: true,
  ssoBypassEnabledRoles: ['ADMIN'],
};

describe('getSsoInviteWarning', () => {
  it('warns when the invitee must use SSO but their email domain is not verified', () => {
    const warning = getSsoInviteWarning({
      email: 'person@other.com',
      role: 'MEMBER',
      ssoConfig: SSO_REQUIRED_FOR_MEMBERS,
      verifiedDomains: ['example.com'],
    });

    expect(warning).toContain('other.com is not one of your verified domains');
  });

  it('does not warn when the invitee is on a verified domain', () => {
    expect(
      getSsoInviteWarning({
        email: 'person@Example.com',
        role: 'MEMBER',
        ssoConfig: SSO_REQUIRED_FOR_MEMBERS,
        verifiedDomains: ['example.com'],
      }),
    ).toBeNull();
  });

  it('does not warn when the invite role may sign in without SSO', () => {
    expect(
      getSsoInviteWarning({
        email: 'person@other.com',
        role: 'ADMIN',
        ssoConfig: SSO_REQUIRED_FOR_MEMBERS,
        verifiedDomains: ['example.com'],
      }),
    ).toBeNull();
  });

  it('does not warn when the team has not turned on SSO', () => {
    expect(
      getSsoInviteWarning({
        email: 'person@other.com',
        role: 'MEMBER',
        ssoConfig: { ...SSO_REQUIRED_FOR_MEMBERS, ssoEnabled: false },
        verifiedDomains: [],
      }),
    ).toBeNull();
  });

  it('does not warn before a domain has been typed', () => {
    expect(getSsoInviteWarning({ email: 'person', role: 'MEMBER', ssoConfig: SSO_REQUIRED_FOR_MEMBERS, verifiedDomains: [] })).toBeNull();
  });

  it('does not warn when the SSO settings are not loaded', () => {
    expect(getSsoInviteWarning({ email: 'person@other.com', role: 'MEMBER', ssoConfig: null, verifiedDomains: [] })).toBeNull();
  });
});
