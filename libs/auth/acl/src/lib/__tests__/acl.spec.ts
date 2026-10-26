import { getDefaultLoginConfigurationUI, type LoginConfigurationUI } from '@jetstream/auth/types';
import {
  ACCESS_PROFILE_OPERATION_KEYS,
  ACCESS_PROFILE_TOOL_KEYS,
  AccessProfilePolicySchema,
  SoqlQueryFormatOptionsSchema,
  type TeamMemberRole,
  type UserProfileUi,
} from '@jetstream/types';
import { canAccessTool, canPerformOperation, getUserAbility } from '../acl';
import { getLoginConfigurationAbility } from '../acl.login-configuration';

const preferences: UserProfileUi['preferences'] = {
  skipFrontdoorLogin: false,
  recordSyncEnabled: false,
  soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.parse({}),
};

const entitlements: UserProfileUi['entitlements'] = {
  googleDrive: false,
  chromeExtension: false,
  desktop: false,
  recordSync: false,
  analysisTools: false,
  salesforceCanvas: false,
};

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
        preferences,
        entitlements,
        subscriptions: [],
        featureFlags: {},
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
        preferences,
        entitlements,
        subscriptions: [],
        featureFlags: {},
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
        preferences,
        entitlements,
        subscriptions: [],
        featureFlags: {},
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
        preferences,
        entitlements,
        subscriptions: [],
        featureFlags: {},
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
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'ACTIVE' })).toBe(true);
        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'MANUAL' })).toBe(true);

        expect(ability.can('invite', { type: 'TeamMember', billingStatus: 'PAST_DUE' })).toBe(false);
      });

      describe('team seats', () => {
        const adminUser: UserProfileUi = {
          ...baseUser,
          teamMembership: { role: 'ADMIN', status: 'ACTIVE', team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' } },
        };
        const billingUser: UserProfileUi = {
          ...baseUser,
          teamMembership: { role: 'BILLING', status: 'ACTIVE', team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' } },
        };
        const memberUser: UserProfileUi = {
          ...baseUser,
          teamMembership: { role: 'MEMBER', status: 'ACTIVE', team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' } },
        };
        const inactiveAdmin: UserProfileUi = {
          ...baseUser,
          teamMembership: { role: 'ADMIN', status: 'INACTIVE', team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' } },
        };

        it('lets admin and billing roles read and update seats', () => {
          for (const user of [adminUser, billingUser]) {
            const ability = getUserAbility({ user });
            expect(ability.can('read', 'TeamSeats')).toBe(true);
            expect(ability.can('update', 'TeamSeats')).toBe(true);
          }
        });

        it('denies seats to members, inactive memberships, and users without a team', () => {
          for (const user of [memberUser, inactiveAdmin, baseUser]) {
            const ability = getUserAbility({ user });
            expect(ability.can('read', 'TeamSeats')).toBe(false);
            expect(ability.can('update', 'TeamSeats')).toBe(false);
          }
        });
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
        preferences,
        entitlements,
        subscriptions: [],
        featureFlags: {},
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

    describe('access profiles', () => {
      function getUser(
        role: TeamMemberRole,
        accessProfile: NonNullable<UserProfileUi['teamMembership']>['accessProfile'] = null,
      ): UserProfileUi {
        return {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          picture: null,
          userId: '1',
          preferences,
          entitlements,
          subscriptions: [],
          featureFlags: {},
          teamMembership: {
            role,
            status: 'ACTIVE',
            team: { id: '1', name: 'Test Team', billingStatus: 'ACTIVE' },
            accessProfile,
          },
        };
      }

      const analystProfile = {
        id: 'profile-1',
        name: 'Analyst',
        version: 1,
        policy: AccessProfilePolicySchema.parse({
          v: 1,
          tools: ['query', 'data-analysis'],
          operations: ['records.write'],
          surfaces: ['web'],
        }),
      };

      it('should grant every tool and operation to users without a team', () => {
        const ability = getUserAbility({ user: { entitlements } });
        expect(ACCESS_PROFILE_TOOL_KEYS.every((key) => canAccessTool(ability, key))).toBe(true);
        expect(ACCESS_PROFILE_OPERATION_KEYS.every((key) => canPerformOperation(ability, key))).toBe(true);
      });

      it('should grant every tool and operation to members without a profile', () => {
        const ability = getUserAbility({ user: getUser('MEMBER') });
        expect(ACCESS_PROFILE_TOOL_KEYS.every((key) => canAccessTool(ability, key))).toBe(true);
        expect(ACCESS_PROFILE_OPERATION_KEYS.every((key) => canPerformOperation(ability, key))).toBe(true);
      });

      it('should only grant the tools and operations in the profile', () => {
        const ability = getUserAbility({ user: getUser('MEMBER', analystProfile) });
        expect(canAccessTool(ability, 'query')).toBe(true);
        expect(canAccessTool(ability, 'data-analysis')).toBe(true);
        expect(canAccessTool(ability, 'load')).toBe(false);
        expect(canAccessTool(ability, 'anonymous-apex')).toBe(false);
        expect(canPerformOperation(ability, 'records.write')).toBe(true);
        expect(canPerformOperation(ability, 'records.delete')).toBe(false);
        expect(canPerformOperation(ability, 'metadata.deploy')).toBe(false);
      });

      it('should apply the profile on desktop and in the browser extension', () => {
        const desktopAbility = getUserAbility({ user: getUser('MEMBER', analystProfile), isDesktop: true });
        const extensionAbility = getUserAbility({ user: getUser('MEMBER', analystProfile), isBrowserExtension: true });
        expect(canAccessTool(desktopAbility, 'load')).toBe(false);
        expect(canAccessTool(extensionAbility, 'load')).toBe(false);
        expect(canAccessTool(desktopAbility, 'query')).toBe(true);
        expect(canAccessTool(extensionAbility, 'query')).toBe(true);
      });

      it('should not let a profile change team dashboard abilities for admins', () => {
        const restrictedAdmin = getUserAbility({
          user: getUser('ADMIN', { ...analystProfile, policy: { ...analystProfile.policy, tools: [] } }),
        });
        const unrestrictedAdmin = getUserAbility({ user: getUser('ADMIN') });
        expect(canAccessTool(restrictedAdmin, 'query')).toBe(false);
        expect(restrictedAdmin.can('update', 'TeamMember')).toBe(unrestrictedAdmin.can('update', 'TeamMember'));
        expect(restrictedAdmin.can('read', 'AuditLog')).toBe(unrestrictedAdmin.can('read', 'AuditLog'));
        expect(restrictedAdmin.can('update', 'Team')).toBe(true);
      });

      it('should only let admins edit and assign access profiles', () => {
        const admin = getUserAbility({ user: getUser('ADMIN') });
        const billing = getUserAbility({ user: getUser('BILLING') });
        const member = getUserAbility({ user: getUser('MEMBER') });
        expect(admin.can('update', 'TeamAccessProfile')).toBe(true);
        expect(billing.can('read', 'TeamAccessProfile')).toBe(true);
        expect(billing.can('update', 'TeamAccessProfile')).toBe(false);
        expect(member.can('read', 'TeamAccessProfile')).toBe(false);
      });

      describe('without the web application', () => {
        const desktopOnlyProfile = { ...analystProfile, policy: { ...analystProfile.policy, surfaces: ['desktop' as const] } };

        it('should remove core functionality, tools and operations in the web app', () => {
          const ability = getUserAbility({ user: getUser('MEMBER', desktopOnlyProfile) });
          expect(ability.can('read', 'CoreFunctionality')).toBe(false);
          expect(ACCESS_PROFILE_TOOL_KEYS.some((key) => canAccessTool(ability, key))).toBe(false);
          expect(ACCESS_PROFILE_OPERATION_KEYS.some((key) => canPerformOperation(ability, key))).toBe(false);
        });

        it('should keep profile and settings in the web app', () => {
          const ability = getUserAbility({ user: getUser('MEMBER', desktopOnlyProfile) });
          expect(ability.can('read', 'Profile')).toBe(true);
          expect(ability.can('read', 'Settings')).toBe(true);
          expect(ability.can('update', 'Settings')).toBe(true);
        });

        it('should keep team dashboard abilities for admins', () => {
          const ability = getUserAbility({ user: getUser('ADMIN', desktopOnlyProfile) });
          expect(ability.can('read', 'Team')).toBe(true);
          expect(ability.can('update', 'TeamAccessProfile')).toBe(true);
          expect(ability.can('read', 'Billing')).toBe(true);
        });

        it('should not affect the desktop application', () => {
          const ability = getUserAbility({ user: getUser('MEMBER', desktopOnlyProfile), isDesktop: true });
          expect(ability.can('read', 'CoreFunctionality')).toBe(true);
          expect(canAccessTool(ability, 'query')).toBe(true);
          expect(canPerformOperation(ability, 'records.write')).toBe(true);
        });
      });

      it('should grant no tools or operations to the billing role', () => {
        const ability = getUserAbility({ user: getUser('BILLING') });
        expect(canAccessTool(ability, 'query')).toBe(false);
        expect(canPerformOperation(ability, 'records.write')).toBe(false);
      });

      describe('canvas app', () => {
        it('should grant every tool and operation without a canvas policy', () => {
          const ability = getUserAbility({ user: { entitlements }, isCanvasApp: true, canvasAccessPolicy: null });
          expect(ACCESS_PROFILE_TOOL_KEYS.every((key) => canAccessTool(ability, key))).toBe(true);
          expect(ACCESS_PROFILE_OPERATION_KEYS.every((key) => canPerformOperation(ability, key))).toBe(true);
        });

        it('should only grant the tools and operations in the canvas policy', () => {
          const ability = getUserAbility({
            user: { entitlements },
            isCanvasApp: true,
            canvasAccessPolicy: { tools: ['query', 'data-analysis'], operations: ['records.write'] },
          });
          expect(canAccessTool(ability, 'query')).toBe(true);
          expect(canAccessTool(ability, 'data-analysis')).toBe(true);
          expect(canAccessTool(ability, 'load')).toBe(false);
          expect(canPerformOperation(ability, 'records.write')).toBe(true);
          expect(canPerformOperation(ability, 'records.delete')).toBe(false);
        });

        it('should grant nothing with an empty canvas policy', () => {
          const ability = getUserAbility({ user: { entitlements }, isCanvasApp: true, canvasAccessPolicy: { tools: [], operations: [] } });
          expect(ACCESS_PROFILE_TOOL_KEYS.some((key) => canAccessTool(ability, key))).toBe(false);
          expect(ACCESS_PROFILE_OPERATION_KEYS.some((key) => canPerformOperation(ability, key))).toBe(false);
        });

        it('should ignore a canvas policy outside the canvas app', () => {
          const ability = getUserAbility({ user: getUser('MEMBER'), canvasAccessPolicy: { tools: [], operations: [] } });
          expect(ACCESS_PROFILE_TOOL_KEYS.every((key) => canAccessTool(ability, key))).toBe(true);
          expect(ACCESS_PROFILE_OPERATION_KEYS.every((key) => canPerformOperation(ability, key))).toBe(true);
        });
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
      preferences,
      entitlements,
      subscriptions: [],
      featureFlags: {},
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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
          ...getDefaultLoginConfigurationUI(),
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

    describe('email change', () => {
      it('should allow email change for a personal account with no login configuration', () => {
        const ability = getLoginConfigurationAbility({ user: baseUser });
        expect(ability.can('update', 'Email')).toBe(true);
      });

      it('should allow email change when the configuration permits it', () => {
        const loginConfiguration: LoginConfigurationUI = {
          ...getDefaultLoginConfigurationUI(),
          emailChange: { allowed: true, blockedReason: null },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', 'Email')).toBe(true);
      });

      it('should block email change when the team is SSO managed', () => {
        const loginConfiguration: LoginConfigurationUI = {
          ...getDefaultLoginConfigurationUI(),
          emailChange: { allowed: false, blockedReason: 'SSO_MANAGED' },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', 'Email')).toBe(false);
      });

      it('should not grant email change from unrelated permissions', () => {
        // Guards against a future refactor accidentally coupling the Email subject to another rule -
        // everything else here is permissive while email change is explicitly disallowed.
        const loginConfiguration: LoginConfigurationUI = {
          ...getDefaultLoginConfigurationUI(),
          isPasswordAllowed: true,
          allowIdentityLinking: true,
          allowedMfaMethods: { email: true, otp: true },
          emailChange: { allowed: false, blockedReason: 'SSO_MANAGED' },
        };

        const ability = getLoginConfigurationAbility({ user: baseUser, loginConfiguration });
        expect(ability.can('update', 'Password')).toBe(true);
        expect(ability.can('update', 'Email')).toBe(false);
      });
    });
  });
});
