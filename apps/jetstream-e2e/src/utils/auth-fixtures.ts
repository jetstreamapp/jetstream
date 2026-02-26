import { prisma } from '@jetstream/api-config';
import { encryptSecret, resolveSamlIdentifiers } from '@jetstream/auth/server';
import { randomUUID } from 'crypto';
import 'dotenv/config';

export interface SsoFixture {
  teamId: string;
  loginConfigId: string;
  userId?: string;
  email: string;
  password?: string;
  domain: string;
}

export interface SsoFixtureOptions {
  ssoEnabled?: boolean;
  ssoProvider?: 'SAML' | 'OIDC';
  domainStatus?: 'VERIFIED' | 'PENDING';
  seedUser?: boolean;
  addTeamMember?: boolean;
  ssoRequireMfa?: boolean;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  samlIdpCertificate?: string;
  samlIdpPrivateKey?: string;
}

export async function createSsoFixture(options: SsoFixtureOptions = {}): Promise<SsoFixture> {
  const {
    ssoEnabled = true,
    ssoProvider = 'SAML',
    domainStatus = 'VERIFIED',
    seedUser = true,
    addTeamMember = true,
    ssoRequireMfa = false,
    oidcIssuer = 'http://localhost:5555',
    oidcClientId = 'client-id',
    oidcClientSecret = 'client-secret',
    samlIdpCertificate,
  } = options;

  const domain = `example-${randomUUID().slice(0, 8)}.test`;
  const email = `user@${domain}`;
  const password = 'Password123!';

  let userId: string | undefined;
  if (seedUser) {
    const user = await prisma.user.create({
      data: {
        email,
        userId: `credentials|${email}`,
        password: await hash(password),
        emailVerified: true,
        name: 'Test User',
        preferences: { create: { skipFrontdoorLogin: false } },
        entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
        identities: {
          create: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: email,
            email,
            emailVerified: true,
            username: email,
            name: 'Test User',
            isPrimary: true,
          },
        },
        authFactors: {
          create: {
            type: '2fa-email',
            enabled: true,
          },
        },
      },
    });
    userId = user.id;
  }

  const team = await prisma.team.create({
    data: {
      name: `SSO Team ${randomUUID().slice(0, 6)}`,
      members: addTeamMember && userId ? { create: { userId, role: 'ADMIN', features: ['ALL'], status: 'ACTIVE' } } : undefined,
      loginConfig: {
        create: {
          allowedMfaMethods: ['otp', 'email'],
          allowedProviders: ['credentials', 'google', 'salesforce'],
          allowIdentityLinking: true,
          requireMfa: false,
          ssoProvider,
          ssoEnabled,
          ssoRequireMfa,
          ssoJitProvisioningEnabled: true,
          domains: domainStatus === 'VERIFIED' ? [domain] : [],
        },
      },
    },
    include: { loginConfig: true },
  });

  await prisma.domainVerification.create({
    data: {
      domain,
      teamId: team.id,
      status: domainStatus,
      verificationCode: `jetstream-verification=${randomUUID()}`,
      verifiedAt: domainStatus === 'VERIFIED' ? new Date() : null,
    },
  });

  if (ssoProvider === 'SAML') {
    const { acsUrl, spEntityId: entityId } = resolveSamlIdentifiers(team.id);

    await prisma.samlConfiguration.create({
      data: {
        loginConfigId: team.loginConfigId!,
        name: 'Test SAML',
        entityId,
        acsUrl,
        idpEntityId: 'https://idp.test/metadata',
        idpSsoUrl: 'https://idp.test/sso',
        idpCertificate: samlIdpCertificate || 'MIIBFAKECERT',
        idpMetadataXml: '<EntityDescriptor/>',
        wantAssertionsSigned: true,
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attributeMapping: {
          email: 'email',
          userName: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
        },
      },
    });
  } else {
    await prisma.oidcConfiguration.create({
      data: {
        loginConfigId: team.loginConfigId!,
        name: 'Test OIDC',
        issuer: oidcIssuer,
        clientId: oidcClientId,
        clientSecret: encryptSecret(oidcClientSecret),
        authorizationEndpoint: `${oidcIssuer}/auth`,
        tokenEndpoint: `${oidcIssuer}/token`,
        userinfoEndpoint: `${oidcIssuer}/userinfo`,
        jwksUri: `${oidcIssuer}/jwks`,
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          userName: 'preferred_username',
          role: 'role',
        },
      },
    });
  }

  return {
    teamId: team.id,
    loginConfigId: team.loginConfigId!,
    userId,
    email,
    password,
    domain,
  };
}

export async function cleanupSsoFixture(fixture?: SsoFixture) {
  if (!fixture) return;
  const { teamId, loginConfigId, domain } = fixture;

  await prisma.domainVerification.deleteMany({ where: { domain } }).catch(() => {});
  await prisma.samlConfiguration.deleteMany({ where: { loginConfigId } }).catch(() => {});
  await prisma.oidcConfiguration.deleteMany({ where: { loginConfigId } }).catch(() => {});
  await prisma.loginConfiguration.deleteMany({ where: { id: loginConfigId } }).catch(() => {});
  await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } }).catch(() => {});
}

async function hash(password: string): Promise<string> {
  // bcryptjs to stay in JS for the test runner
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}
