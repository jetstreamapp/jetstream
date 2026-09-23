import { describe, expect, it } from 'vitest';
import { isSsoRequiredForRole, SsoRequirementConfig } from '../sso-requirement';

const SSO_REQUIRED_FOR_MEMBERS: SsoRequirementConfig = {
  ssoEnabled: true,
  ssoProvider: 'SAML',
  ssoBypassEnabled: true,
  ssoBypassEnabledRoles: ['ADMIN'],
};

describe('isSsoRequiredForRole', () => {
  it('does not require SSO when the team has not turned it on', () => {
    expect(isSsoRequiredForRole({ ...SSO_REQUIRED_FOR_MEMBERS, ssoEnabled: false }, 'MEMBER')).toBe(false);
  });

  it('does not require SSO when no SSO provider is configured', () => {
    expect(isSsoRequiredForRole({ ...SSO_REQUIRED_FOR_MEMBERS, ssoProvider: 'NONE' }, 'MEMBER')).toBe(false);
  });

  it('requires SSO for every role when bypass is off', () => {
    expect(isSsoRequiredForRole({ ...SSO_REQUIRED_FOR_MEMBERS, ssoBypassEnabled: false }, 'ADMIN')).toBe(true);
  });

  it('requires SSO for a role the team does not let bypass it', () => {
    expect(isSsoRequiredForRole(SSO_REQUIRED_FOR_MEMBERS, 'MEMBER')).toBe(true);
  });

  it('does not require SSO for a role the team lets bypass it', () => {
    expect(isSsoRequiredForRole(SSO_REQUIRED_FOR_MEMBERS, 'ADMIN')).toBe(false);
  });

  it('requires SSO when there is no role to check', () => {
    expect(isSsoRequiredForRole(SSO_REQUIRED_FOR_MEMBERS, null)).toBe(true);
  });
});
