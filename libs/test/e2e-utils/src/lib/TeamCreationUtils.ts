import { prisma } from '@jetstream/api-config';
import { LoginConfiguration, SessionData } from '@jetstream/auth/types';
import { TeamBillingStatusSchema, TeamMemberRole, TeamMemberRoleSchema, TeamMemberStatus, TeamMemberStatusSchema } from '@jetstream/types';
import { encodeHexLowerCase, encodeHexUpperCase } from '@oslojs/encoding';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { AuthenticationPage } from './pageObjectModels/AuthenticationPage.model';
import chalk = require('chalk');

type Team = Awaited<ReturnType<TeamCreationUtils['createTeam']>>;
type TeamMember = Awaited<ReturnType<TeamCreationUtils['createTeam']>>['members'][number];
interface UserWithTeamMember {
  userId: string;
  user: { name: string; email: string; password: string };
  teamMembership: TeamMember;
  otpSecret?: string;
}

interface UserWithTeamMemberAndBrowserContext extends UserWithTeamMember {
  context: BrowserContext;
}

export class TeamCreationUtils {
  // used for debugging if something goes wrong during setup
  users: { email: string; name: string; password: string }[] = [];
  // Store data as soon as we know about it so that we can cleanup even if there is a partial failure
  userEmails: string[] = [];
  userIds: string[] = [];
  teamIds: string[] = [];

  team: Team;
  adminUser: UserWithTeamMember;
  // EMAIL + PASSWORD, MEMBER
  member1: UserWithTeamMemberAndBrowserContext;
  // EMAIL + PASSWORD + OTP + GOOGLE + SALESFORCE, MEMBER
  member2: UserWithTeamMemberAndBrowserContext;
  // EMAIL + PASSWORD + OTP + GOOGLE, BILLING
  member3: UserWithTeamMemberAndBrowserContext;

  get members() {
    return [this.member1, this.member2, this.member3] as const;
  }

  /**
   * Create Team With Admin User But No Other Members
   */
  async createTestTeamWithoutMembers({ page }: { page: Page }) {
    const [adminUser] = await Promise.all([
      (async () => {
        const authPage = new AuthenticationPage(page);
        const user = await authPage.signUpAndVerifyEmail();
        const otpSecret = await authPage.enrollInOtpForLoggedInUser();
        return { user, otpSecret };
      })(),
    ]);

    this.users.push(adminUser.user);
    this.userEmails.push(adminUser.user.email);

    this.team = await this.createTeam({
      email: adminUser.user.email,
      members: [],
    });
    const team = this.team;
    this.adminUser = {
      ...adminUser,
      userId: team.members.find(({ user }) => adminUser.user.email === user.email)!.userId,
      teamMembership: team.members.find(({ user }) => adminUser.user.email === user.email)!,
    };
    this.teamIds.push(team.id);
    team.members.forEach(({ userId }) => this.userIds.push(userId));

    await page.reload(); // Ensure updated session is obtained for admin user
  }

  /**
   * Create Team With Admin Users and 3 additional users
   */
  async createTestTeamAndUsers({ browser, page }: { browser: Browser; page: Page }) {
    // Isolated context to allow additional member logins
    const [adminUser, user1, user2, user3] = await Promise.all([
      (async () => {
        const authPage = new AuthenticationPage(page);
        const user = await authPage.signUpAndVerifyEmail();
        const otpSecret = await authPage.enrollInOtpForLoggedInUser();
        return { user, otpSecret };
      })(),
      browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
        return context.newPage().then(async (page) => {
          const user = await new AuthenticationPage(page).signUpAndVerifyEmail();
          await page.close();
          return { user, context };
        });
      }),
      browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
        return context.newPage().then(async (page) => {
          const authPage = new AuthenticationPage(page);
          const user = await authPage.signUpAndVerifyEmail();
          const otpSecret = await authPage.enrollInOtpForLoggedInUser();
          await page.close();
          return { user, context, otpSecret };
        });
      }),
      browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
        return context.newPage().then(async (page) => {
          const authPage = new AuthenticationPage(page);
          const user = await authPage.signUpAndVerifyEmail();
          const otpSecret = await authPage.enrollInOtpForLoggedInUser();
          await page.close();
          return { user, context, otpSecret };
        });
      }),
    ]);

    this.users.push(adminUser.user, user1.user, user2.user, user3.user);
    this.userEmails.push(adminUser.user.email, user1.user.email, user2.user.email, user3.user.email);

    this.team = await this.createTeam({
      email: adminUser.user.email,
      // manualBilling: true,
      // licenseCountLimit: 5,
      members: [
        {
          userId: (await prisma.user.findFirstOrThrow({ where: { email: user1.user.email } })).id,
          role: TeamMemberRoleSchema.enum.MEMBER,
          status: TeamMemberStatusSchema.enum.ACTIVE,
        },
        {
          userId: (await prisma.user.findFirstOrThrow({ where: { email: user2.user.email } })).id,
          role: TeamMemberRoleSchema.enum.MEMBER,
          status: TeamMemberStatusSchema.enum.ACTIVE,
        },
        {
          userId: (await prisma.user.findFirstOrThrow({ where: { email: user3.user.email } })).id,
          role: TeamMemberRoleSchema.enum.BILLING,
          status: TeamMemberStatusSchema.enum.ACTIVE,
        },
      ],
    });
    const team = this.team;
    this.adminUser = {
      ...adminUser,
      userId: team.members.find(({ user }) => adminUser.user.email === user.email)!.userId,
      teamMembership: team.members.find(({ user }) => adminUser.user.email === user.email)!,
    };
    this.teamIds.push(team.id);
    team.members.forEach(({ userId }) => this.userIds.push(userId));

    // Create auth identities for user2
    const adminUserId = team.members.find(({ user }) => adminUser.user.email === user.email).userId;
    const user2Id = team.members.find(({ user }) => user2.user.email === user.email).userId;
    const user3Id = team.members.find(({ user }) => user3.user.email === user.email).userId;
    await prisma.authIdentity.createMany({
      data: [
        {
          name: adminUser.user.name,
          email: adminUser.user.email,
          username: adminUser.user.email,
          givenName: 'Test',
          familyName: 'Test',
          provider: 'google',
          type: 'oauth',
          isPrimary: false,
          providerAccountId: encodeHexLowerCase(crypto.getRandomValues(new Uint8Array(11))),
          userId: adminUserId,
        },
        {
          name: user2.user.name,
          email: user2.user.email,
          username: user2.user.email,
          givenName: 'Test',
          familyName: 'Test',
          provider: 'google',
          type: 'oauth',
          isPrimary: false,
          providerAccountId: encodeHexLowerCase(crypto.getRandomValues(new Uint8Array(11))),
          userId: user2Id,
        },
        {
          name: user2.user.name,
          email: user2.user.email,
          username: user2.user.email,
          givenName: 'Test',
          familyName: 'Test',
          provider: 'salesforce',
          type: 'oauth',
          isPrimary: false,
          providerAccountId: `https://login.salesforce.com/id/00D50000000O712EAC/0056${encodeHexUpperCase(crypto.getRandomValues(new Uint8Array(7)))}`,
          userId: user2Id,
        },
        {
          name: user3.user.name,
          email: user3.user.email,
          username: user3.user.email,
          givenName: 'Test',
          familyName: 'Test',
          provider: 'google',
          type: 'oauth',
          isPrimary: false,
          providerAccountId: encodeHexLowerCase(crypto.getRandomValues(new Uint8Array(11))),
          userId: user3Id,
        },
      ],
    });

    // Update user2 session to show up is if the user logged in via Google so we can test login configuration correctly
    const user2Session = await prisma.sessions.findFirst({ where: { userId: user2Id } });
    if (user2Session) {
      const session = user2Session.sess as unknown as SessionData;
      session.provider = 'google';
      await prisma.sessions.update({ where: { sid: user2Session.sid }, data: { sess: session as any } });
    }

    await page.reload(); // Ensure updated session is obtained for admin user

    this.member1 = {
      ...user1,
      userId: team.members.find(({ user }) => user1.user.email === user.email)!.userId,
      teamMembership: team.members.find(({ user }) => user1.user.email === user.email)!,
    };
    this.member2 = {
      ...user2,
      userId: team.members.find(({ user }) => user2.user.email === user.email)!.userId,
      teamMembership: team.members.find(({ user }) => user2.user.email === user.email)!,
    };
    this.member3 = {
      ...user3,
      userId: team.members.find(({ user }) => user3.user.email === user.email)!.userId,
      teamMembership: team.members.find(({ user }) => user3.user.email === user.email)!,
    };
  }

  /**
   * Helper function to create team in DB
   */
  private async createTeam({
    email,
    members = [],
    loginConfiguration,
    manualBilling,
    licenseCountLimit,
  }: {
    email: string;
    members?: Array<{ userId: string; role: TeamMemberRole; status: TeamMemberStatus }>;
    loginConfiguration?: Partial<
      Pick<LoginConfiguration, 'allowedMfaMethods' | 'allowedProviders' | 'requireMfa' | 'allowIdentityLinking' | 'autoAddToTeam'>
    >;
    manualBilling?: boolean;
    licenseCountLimit?: number;
  }) {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true, name: true, email: true }, where: { email } });
    const team = await prisma.team.create({
      select: {
        id: true,
        name: true,
        billingAccount: true,
        loginConfig: true,
        entitlements: true,
        members: {
          select: { teamId: true, userId: true, role: true, status: true, user: { select: { id: true, name: true, email: true } } },
        },
      },
      data: {
        name: `[PLAYWRIGHT] Test Team for ${user.email}`,
        billingStatus: TeamBillingStatusSchema.enum.ACTIVE,
        status: TeamMemberStatusSchema.enum.ACTIVE,
        createdByUser: { connect: { id: user.id } },
        updatedByUser: { connect: { id: user.id } },
        members: {
          createMany: {
            data: [
              {
                userId: user.id,
                role: TeamMemberRoleSchema.enum.ADMIN,
                status: TeamMemberStatusSchema.enum.ACTIVE,
                createdById: user.id,
                updatedById: user.id,
              },
              ...members.map(({ role, status, userId }) => ({ userId, role, status, createdById: user.id, updatedById: user.id })),
            ],
          },
        },
        loginConfig: {
          create: {
            allowedMfaMethods: loginConfiguration?.allowedMfaMethods
              ? (Array.from(loginConfiguration.allowedMfaMethods).map((value) => value.split('-')[1]) as any)
              : undefined,
            allowedProviders: loginConfiguration?.allowedProviders ? Array.from(loginConfiguration?.allowedProviders) : undefined,
            requireMfa: loginConfiguration?.requireMfa,
            allowIdentityLinking: loginConfiguration?.allowIdentityLinking,
            autoAddToTeam: loginConfiguration?.autoAddToTeam,
            createdById: user.id,
            updatedById: user.id,
          },
        },
        entitlements: {
          create: {
            googleDrive: true,
            chromeExtension: true,
            desktop: true,
            recordSync: true,
          },
        },
        billingAccount: {
          create: { customerId: `test_${encodeHexLowerCase(crypto.getRandomValues(new Uint8Array(7)))}`, manualBilling, licenseCountLimit },
        },
      },
    });

    // Add team membership to all existing sessions for all users
    for (let member of team.members) {
      const sessions = await prisma.sessions.findMany({ where: { userId: member.userId } });
      for (let session of sessions) {
        if (typeof session.sess === 'object' && !Array.isArray(session.sess) && session.sess !== null) {
          session.sess.teamMembership = { role: member.role, status: member.status, teamId: team.id };
          await prisma.sessions.update({
            where: { sid: session.sid },
            data: { sess: session.sess },
          });
        }
      }
    }

    return team;
  }

  // If data is not cleaned up, show information so that login can be performed and tested manually
  debug() {
    function printUser(user: UserWithTeamMember['user']) {
      console.info(chalk.blue('\n\nUser Login Info'));
      console.info(chalk.green('Email:'), user.email);
      console.info(chalk.green('Password:'), user.password);
    }
    if (!this.team) {
      return;
    }
    console.log('TeamCreationUtils Debug Info:');
    this.team && console.log('Team:', this.team.id, this.team.name);
    this.users.forEach((user) => printUser(user));
  }

  async cleanup() {
    await prisma
      .$transaction([
        prisma.team.deleteMany({ where: { id: { in: this.teamIds } } }),
        prisma.user.deleteMany({ where: { OR: [{ id: { in: this.userIds } }, { email: { in: this.userEmails } }] } }),
        prisma.sessions.deleteMany({ where: { userId: { in: this.userIds } } }),
      ])
      .catch((ex) => {
        console.error('Error during cleanup of teamSetup', ex);
      })
      .then((results) => {
        console.log('Cleanup of teamSetup complete', results);
      });
  }
}
