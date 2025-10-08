import type { LoginConfigurationUI } from '@jetstream/auth/types';
import { type UserProfileUi } from '@jetstream/types';
import { getUserAbility } from '../acl';
import { getLoginConfigurationAbility } from '../acl.login-configuration';

describe('acl', () => {
  describe('getUserAbility', () => {
    it('should return empty rules for no user', () => {
      const ability = getUserAbility({});
      expect(ability.rules).toEqual([]);
    });

    it('should grant core functionality and settings to regular users', () => {
      const user: UserProfileUi = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        picture: null,
        userId: '1',
        preferences: {
          skipFrontdoorLogin: false,
          recordSyncEnabled: false,
        },
        entitlements: {
          googleDrive: false,
          chromeExtension: false,
          desktop: false,
          recordSync: false,
        },
        subscriptions: [],
      };

      const ability = getUserAbility({ user });
      expect(ability.can('read', 'CoreFunctionality')).toBe(true);
      expect(ability.can('read', 'Settings')).toBe(true);
      expect(ability.can('update', 'Settings')).toBe(true);
    });

    it('should deny core functionality to billing role users', () => {
      const user: UserProfileUi = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        picture: null,
        userId: '1',
        preferences: {
          skipFrontdoorLogin: false,
          recordSyncEnabled: false,
        },
        entitlements: {
          googleDrive: false,
          chromeExtension: false,
          desktop: false,
          recordSync: false,
        },
        subscriptions: [],
        teamMembership: {
          role: 'BILLING',
          status: 'ACTIVE',
          team: {
            id: '1',
            name: 'Test Team',
            billingStatus: 'ACTIVE',
          },
        },
      };

      const ability = getUserAbility({ user });
      expect(ability.can('read', 'CoreFunctionality')).toBe(false);
      expect(ability.can('read', 'Settings')).toBe(false);
      expect(ability.can('update', 'Settings')).toBe(false);
      expect(ability.can('update', 'Team')).toBe(true);
      expect(ability.can('delete', 'TeamMemberSession')).toBe(false);
    });

    describe('team permissions', () => {
      const user: UserProfileUi = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        picture: null,
        userId: '1',
        preferences: { skipFrontdoorLogin: false, recordSyncEnabled: false },
        entitlements: { googleDrive: false, chromeExtension: false, desktop: false, recordSync: false },
        subscriptions: [],
        teamMembership: {
          role: 'ADMIN',
          status: 'ACTIVE',
          team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' },
        },
      };

      it('should grant full permissions to admin users', () => {
        const ability = getUserAbility({ user });
        expect(ability.can('read', 'Team')).toBe(true);
        expect(ability.can('read', 'TeamMemberSession')).toBe(true);
        expect(ability.can('read', 'TeamMemberAuthActivity')).toBe(true);
        expect(ability.can('read', 'TeamMember')).toBe(true);
        expect(ability.can('update', 'Team')).toBe(true);
        expect(ability.can('update', 'TeamMember')).toBe(true);
        expect(ability.can('invite', 'TeamMember')).toBe(true);
        expect(ability.can('delete', 'TeamMemberSession')).toBe(true);
      });
    });

    describe('web app permissions', () => {
      const baseUser: UserProfileUi = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        picture: null,
        userId: '1',
        preferences: {
          skipFrontdoorLogin: false,
          recordSyncEnabled: false,
        },
        entitlements: {
          googleDrive: false,
          chromeExtension: false,
          desktop: false,
          recordSync: false,
        },
        subscriptions: [],
      };

      it('should grant profile access in web app', () => {
        const ability = getUserAbility({ user: baseUser });
        expect(ability.can('read', 'Profile')).toBe(true);
      });

      it('should grant billing access to users without team membership', () => {
        const ability = getUserAbility({ user: baseUser });
        expect(ability.can('read', 'Billing')).toBe(true);
        expect(ability.can('update', 'Billing')).toBe(true);
      });

      it('should grant team management to admin users', () => {
        const user: UserProfileUi = {
          ...baseUser,
          teamMembership: {
            role: 'ADMIN',
            status: 'ACTIVE',
            team: {
              id: '1',
              name: 'Test Team',
              billingStatus: 'ACTIVE',
            },
          },
        };

        const ability = getUserAbility({ user });
        expect(ability.can('read', 'Team')).toBe(true);
        expect(ability.can('update', 'Team')).toBe(true);
        expect(ability.can('read', 'TeamMember')).toBe(true);
        expect(ability.can('update', 'TeamMember')).toBe(true);
      });

      it('should grant limited team access to billing users', () => {
        const user: UserProfileUi = {
          ...baseUser,
          teamMembership: {
            role: 'BILLING',
            status: 'ACTIVE',
            team: {
              id: '1',
              name: 'Test Team',
              billingStatus: 'ACTIVE',
            },
          },
        };

        const ability = getUserAbility({ user });
        expect(ability.can('read', 'Team')).toBe(true);
        expect(ability.can('update', 'Team')).toBe(true);
        expect(ability.can('read', 'TeamMember')).toBe(true);
        expect(ability.can('update', 'TeamMember')).toBe(true);
      });

      it('should deny team access to inactive team members', () => {
        const user: UserProfileUi = {
          ...baseUser,
          teamMembership: {
            role: 'ADMIN',
            status: 'INACTIVE',
            team: {
              id: '1',
              name: 'Test Team',
              billingStatus: 'ACTIVE',
            },
          },
        };

        const ability = getUserAbility({ user });
        expect(ability.can('read', 'Team')).toBe(false);
        expect(ability.can('update', 'Team')).toBe(false);
      });

      it('should grant invite team member to admin users', () => {
        const user: UserProfileUi = {
          ...baseUser,
          teamMembership: {
            role: 'ADMIN',
            status: 'ACTIVE',
            team: {
              id: '1',
              name: 'Test Team',
              billingStatus: 'ACTIVE',
            },
          },
        };

        const ability = getUserAbility({ user });
        expect(ability.can('invite', 'TeamMember')).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE', availableLicenses: Infinity })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL', availableLicenses: Infinity })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE', availableLicenses: 100 })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE', availableLicenses: 1 })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL', availableLicenses: 100 })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL', availableLicenses: 1 })).toBe(true);

        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'PAST_DUE', availableLicenses: Infinity })).toBe(false);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL', availableLicenses: 0 })).toBe(false);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL', availableLicenses: -1 })).toBe(false);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE', availableLicenses: -1 })).toBe(false);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE', availableLicenses: 0 })).toBe(false);
      });
    });

    describe('desktop and extension permissions', () => {
      const user: UserProfileUi = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        picture: null,
        userId: '1',
        preferences: {
          skipFrontdoorLogin: false,
          recordSyncEnabled: false,
        },
        entitlements: {
          googleDrive: false,
          chromeExtension: false,
          desktop: false,
          recordSync: false,
        },
        subscriptions: [],
      };

      it('should not grant profile access in desktop app', () => {
        const ability = getUserAbility({ user, isDesktop: true });
        expect(ability.can('read', 'Profile')).toBe(false);
      });

      it('should not grant profile access in browser extension', () => {
        const ability = getUserAbility({ user, isBrowserExtension: true });
        expect(ability.can('read', 'Profile')).toBe(false);
      });
    });
  });

  describe('getLoginConfigurationAbility', () => {
    const baseUser: UserProfileUi = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      picture: null,
      userId: '1',
      preferences: {
        skipFrontdoorLogin: false,
        recordSyncEnabled: false,
      },
      entitlements: {
        googleDrive: false,
        chromeExtension: false,
        desktop: false,
        recordSync: false,
      },
      subscriptions: [],
    };

    it('should return empty rules for no user', () => {
      const ability = getLoginConfigurationAbility({});
      expect(ability.rules).toEqual([]);
    });

    describe('default configuration (no login config provided)', () => {
      it('should allow all actions when no configuration is provided', () => {
        const ability = getLoginConfigurationAbility({ user: baseUser });

        expect(ability.can('link', 'Identity')).toBe(true);
        expect(ability.can('unlink', 'Identity')).toBe(true);
        expect(ability.can('read', 'Password')).toBe(true);
        expect(ability.can('update', 'Password')).toBe(true);
        expect(ability.can('remove', 'Password')).toBe(true);
        expect(ability.can('update', 'MFA')).toBe(true);
        expect(ability.can('remove', 'MFA')).toBe(true);
      });
    });

    describe('password management', () => {
      it('should allow password actions when password is allowed', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('read', 'Password')).toBe(true);
        expect(ability.can('update', 'Password')).toBe(true);
        expect(ability.can('remove', 'Password')).toBe(true);
      });

      it('should only allow password removal when password is not allowed', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: false,
          isGoogleAllowed: true,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('read', 'Password')).toBe(false);
        expect(ability.can('update', 'Password')).toBe(false);
        expect(ability.can('remove', 'Password')).toBe(true);
      });
    });

    describe('identity provider management', () => {
      it('should allow Google identity linking when enabled', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: true,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });

        const foo = ability.relevantRuleFor('link', { type: 'Identity', provider: 'google' });
        console.log(foo);

        expect(ability.can('link', { type: 'Identity', provider: 'google' })).toBe(true);
        expect(ability.can('unlink', { type: 'Identity', provider: 'google' })).toBe(true);
        expect(ability.can('link', { type: 'Identity', provider: 'salesforce' })).toBe(false);
      });

      it('should allow Salesforce identity linking when enabled', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: true,
          requireMfa: false,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('link', { type: 'Identity', provider: 'salesforce' })).toBe(true);
        expect(ability.can('unlink', { type: 'Identity', provider: 'salesforce' })).toBe(true);
        expect(ability.can('link', { type: 'Identity', provider: 'google' })).toBe(false);
      });

      it('should deny all identity linking when disabled', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: true,
          isSalesforceAllowed: true,
          requireMfa: false,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('link', { type: 'Identity', provider: 'google' })).toBe(false);
        expect(ability.can('link', { type: 'Identity', provider: 'salesforce' })).toBe(false);
      });
    });

    describe('MFA management', () => {
      it('should allow email MFA when enabled', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: true, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('remove', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'otp' })).toBe(false);
      });

      it('should allow OTP MFA when enabled', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: false, otp: true },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', { type: 'MFA', method: 'otp' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'otp' })).toBe(true);
        expect(ability.can('remove', { type: 'MFA', method: 'otp' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'email' })).toBe(false);
      });

      it('should prevent MFA removal when MFA is required', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: false,
          requireMfa: true,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: true, otp: true },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'otp' })).toBe(true);
        expect(ability.can('remove_all', 'MFA')).toBe(false);
        expect(ability.can('remove', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('remove', { type: 'MFA', method: 'otp' })).toBe(true);
      });

      it('should allow generic MFA removal when not required', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: false,
          isSalesforceAllowed: false,
          requireMfa: false,
          allowIdentityLinking: false,
          allowedMfaMethods: { email: true, otp: true },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('remove', 'MFA')).toBe(true);
        expect(ability.can('remove_all', 'MFA')).toBe(true);
        expect(ability.can('remove', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('remove', { type: 'MFA', method: 'otp' })).toBe(true);
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple identity providers and MFA methods', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: true,
          isGoogleAllowed: true,
          isSalesforceAllowed: true,
          requireMfa: false,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: true, otp: true },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });

        // Password
        expect(ability.can('read', 'Password')).toBe(true);

        // Identity providers
        expect(ability.can('link', { type: 'Identity', provider: 'google' })).toBe(true);
        expect(ability.can('link', { type: 'Identity', provider: 'salesforce' })).toBe(true);

        // MFA methods
        expect(ability.can('update', { type: 'MFA', method: 'email' })).toBe(true);
        expect(ability.can('update', { type: 'MFA', method: 'otp' })).toBe(true);
        expect(ability.can('remove', 'MFA')).toBe(true);
      });

      it('should handle identity-only authentication (no password)', () => {
        const loginConfiguration: LoginConfigurationUI = {
          isPasswordAllowed: false,
          isGoogleAllowed: true,
          isSalesforceAllowed: true,
          requireMfa: false,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: false, otp: false },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });

        // Can only remove password, not set or update
        expect(ability.can('read', 'Password')).toBe(false);
        expect(ability.can('update', 'Password')).toBe(false);
        expect(ability.can('remove', 'Password')).toBe(true);

        // Can manage identities
        expect(ability.can('link', { type: 'Identity', provider: 'google' })).toBe(true);
        expect(ability.can('link', { type: 'Identity', provider: 'salesforce' })).toBe(true);
      });
    });
  });
});
