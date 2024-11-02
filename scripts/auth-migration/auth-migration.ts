import { Prisma, PrismaClient } from '@prisma/client';
import { ManagementClient } from 'auth0';
import { writeFileSync } from 'fs-extra';
import { isString } from 'lodash';
import path from 'path';
import { pipeline, Readable, Writable } from 'stream';
import { promisify } from 'util';
import { createGunzip } from 'zlib';

const pipelineAsync = promisify(pipeline);

/**
 * Run this with `bun auth-migration.ts`
 */

const ENV = {
  CLIENT_ID: `${process.env.AUTH0_MGMT_CLIENT_ID}`,
  CLIENT_SECRET: `${process.env.AUTH0_MGMT_CLIENT_SECRET}`,
  DOMAIN: `${process.env.AUTH0_DOMAIN}`,
  M2M_DOMAIN: `${process.env.AUTH0_M2M_DOMAIN}`,
  JETSTREAM_POSTGRES_DBURI: `${process.env.JETSTREAM_POSTGRES_DBURI}`,
};

console.log(JSON.stringify(ENV, null, 2));

export const prisma = new PrismaClient({});

const management = new ManagementClient({
  domain: ENV.DOMAIN,
  clientId: ENV.CLIENT_ID,
  clientSecret: ENV.CLIENT_SECRET,
});

interface Auth0User {
  user_id: string;
  nickname: string;
  updated_at: string;
  user_metadata?: any;
  identities: (Auth0Identity | GoogleIdentity | SalesforceIdentity)[];
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  last_login?: string;
  last_ip?: string;
  logins_count?: number;
  app_metadata: any;
}

interface Auth0Identity {
  profileData: {
    email: string;
    email_verified: boolean;
    last_password_reset?: string;
  };
  user_id: string;
  provider: 'auth0';
  connection: 'Username-Password-Authentication';
  isSocial: false;
}

interface GoogleIdentity {
  profileData: {
    email: string;
    email_verified: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
  };
  provider: 'google-oauth2';
  user_id: string;
  connection: 'google-oauth2';
  isSocial: true;
}
interface SalesforceIdentity {
  profileData: {
    picture: string;
    picture_thumbnail: string;
    email: string;
    name: string;
    family_name: string;
    given_name: string;
    nickname: string;
    email_verified: boolean;
    id: string;
    organization_id: string;
    username: string;
    urls: Record<string, string>;
    active: boolean;
    user_type: 'STANDARD';
    language: 'en_US';
    locale: 'en_US';
    utcOffset: number;
    last_modified_date: string;
  };
  provider: 'salesforce';
  user_id: string;
  connection: 'salesforce';
  isSocial: true;
}

const timestamp = formatTimestampForFilename();

const DATA_DIR = path.join(__dirname, 'data');
const outputAuth0PathJson = path.join(DATA_DIR, `jetstream-users-${timestamp}-PRE_AUTH0.json`);
const outputPreUpdatePathJson = path.join(DATA_DIR, `jetstream-users-${timestamp}-PRE_UPDATE.json`);
const outputPathSuccessJson = path.join(DATA_DIR, `jetstream-users-${timestamp}-OUT_SUCCESS.json`);
const outputPathErrorsJson = path.join(DATA_DIR, `jetstream-users-${timestamp}-OUT_ERROR.json`);
const outputPathAllJson = path.join(DATA_DIR, `jetstream-users-${timestamp}-OUT_ALL.json`);

function formatTimestampForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function unzipBufferToMemory(buffer: Buffer): Promise<Buffer> {
  const gunzip = createGunzip();
  const source = Readable.from(buffer);

  let chunks: Buffer[] = [];
  const destination = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });

  try {
    await pipelineAsync(source, gunzip, destination);
    return Buffer.concat(chunks);
  } catch (err) {
    console.error('An error occurred:', err);
    throw err;
  }
}

function convertJsonLinesToJson(jsonLines: string): any[] {
  const lines = jsonLines.split('\n').filter((line) => line.trim() !== '');
  const jsonArray = lines.map((line) => JSON.parse(line));
  return jsonArray;
}

async function delay(milliseconds: number) {
  // return await for better async stack trace support in case of errors.
  return await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * **********************************************
 * EXPORT USERS FUNCTION
 * **********************************************
 */
async function exportUsers() {
  let response = await management.jobs.exportUsers({
    format: 'json',
    fields: [
      { name: 'user_id' },
      { name: 'nickname' },
      { name: 'updated_at' },
      { name: 'user_metadata' },
      { name: 'identities' },
      { name: 'name' },
      { name: 'picture' },
      { name: 'email' },
      { name: 'email_verified' },
      { name: 'created_at' },
      { name: 'last_login' },
      { name: 'last_ip' },
      { name: 'logins_count' },
      { name: 'app_metadata' },
    ],
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP error! status: ${response.status}. ${JSON.stringify(response.data)}`);
  }

  let numChecks = 0;
  const maxChecks = 10;
  const interval = 1000;

  let job = response.data;

  while (numChecks < maxChecks) {
    response = await management.jobs.get({ id: job.id });
    job = response.data;
    if (job.status === 'completed') {
      if (!isString(job.location)) {
        throw new Error('Job location is missing');
      }
      console.log(job.location);
      const userExportResponse = await fetch(job.location);
      if (!userExportResponse.ok) {
        throw new Error(`HTTP error! status: ${userExportResponse.status}`);
      }

      const results = await unzipBufferToMemory(Buffer.from(await userExportResponse.arrayBuffer()));
      const jsonLines = results.toString('utf8');
      let users = convertJsonLinesToJson(jsonLines) as Auth0User[];

      console.log('Saving auth0 users to', outputAuth0PathJson);
      writeFileSync(outputAuth0PathJson, JSON.stringify(users, null, 2));

      return users;
    }
    await delay(interval);
    numChecks++;
  }
  throw new Error('Export job did not complete in time');
}

/**
 * **********************************************
 * UPDATE IN JETSTREAM DATABASE
 * **********************************************
 */
async function updateUsersInJetstreamDatabase(users: Auth0User[]) {
  console.log('Preparing users for import');
  const userUpdateInput = users.map((user) => {
    const jetstreamUser: Prisma.UserUpdateInput = {
      userId: user.user_id,
      email: user.email,
      emailVerified: user.email_verified ?? false,
      name: (user.name || user.email).trim(),
      nickname: (user.nickname || user.name || user.email).trim(),
      picture: user.picture || null,
      updatedAt: new Date(),
      password: null, // TODO: if there is a password, set this
      passwordUpdatedAt: null, // TODO: if there is a password, set this
    };
    const jetstreamAuthFactors: Prisma.AuthFactorsCreateWithoutUserInput[] = [];
    const jetstreamAuthIdentity: Prisma.AuthIdentityCreateWithoutUserInput[] = [];

    jetstreamAuthFactors.push({
      enabled: true, // Users can choose "remember this device" or disable in settings
      secret: null,
      type: '2fa-email',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let identities = user.identities;
    let isFirstItemPrimary = true;
    if (user.identities[0].provider === 'auth0') {
      identities = user.identities.slice(1);
      isFirstItemPrimary = false;
    }

    (identities as (GoogleIdentity | SalesforceIdentity)[]).forEach((identity, i) => {
      jetstreamAuthIdentity.push({
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: identity.provider === 'google-oauth2' ? 'google' : 'salesforce',
        providerAccountId: (identity.profileData as any).id || identity.user_id,
        email: identity.profileData.email,
        emailVerified: identity.profileData.email_verified,
        familyName: identity.profileData.family_name,
        givenName: identity.profileData.given_name,
        isPrimary: isFirstItemPrimary && i === 0,
        name: (identity.profileData.name || identity.profileData.email).trim(),
        picture: identity.profileData.picture,
        type: 'oauth',
        username: (identity.profileData as any).username || identity.profileData.email,
      });
    });

    return Prisma.validator<Prisma.UserUpdateInput>()({
      ...jetstreamUser,
      authFactors: {
        createMany: {
          data: jetstreamAuthFactors,
        },
      },
      identities: {
        createMany: {
          data: jetstreamAuthIdentity,
        },
      },
    });
  });

  console.log('Saving pre-update file to', outputPreUpdatePathJson);
  writeFileSync(outputPreUpdatePathJson, JSON.stringify(userUpdateInput, null, 2));

  console.log('Updating users in Jetstream database');

  const results: {
    success: boolean;
    error?: string;
    user?: any;
  }[] = [];

  // TODO: if we want to run this multiple times, then we might want to delete the authFactors and identities first

  for (let userInput of userUpdateInput) {
    try {
      console.log(`Attempting to update  ${userInput.userId} (${userInput.email})`);
      if (!isString(userInput.userId)) {
        throw new Error('User ID is required');
      }

      const existingUser = await prisma.user.findFirst({
        where: { userId: userInput.userId },
        select: {
          id: true,
          userId: true,
          authFactors: {
            select: {
              type: true,
              userId: true,
            },
          },
          identities: {
            select: {
              type: true,
              provider: true,
              providerAccountId: true,
            },
          },
        },
      });

      if (!existingUser) {
        throw new Error(`User not found with id: ${userInput.userId}`);
      }

      // TODO: I could calculate if we need to update the authFactors here?

      results.push({
        success: true,
        user: await prisma.user.update({
          data: userInput,
          where: { userId: userInput.userId },
          include: {
            authFactors: true,
            identities: true,
          },
        }),
      });
    } catch (ex) {
      console.error('Error updating user', ex);
      results.push({
        success: false,
        error: (ex as Error).message,
      });
    }
  }

  console.log('Saving success-update file to', outputPathSuccessJson);
  console.log('Saving errors-update file to', outputPathErrorsJson);
  console.log('Saving all-update file to', outputPathAllJson);
  writeFileSync(
    outputPathSuccessJson,
    JSON.stringify(
      results.filter(({ success }) => success),
      null,
      2
    )
  );
  writeFileSync(
    outputPathErrorsJson,
    JSON.stringify(
      results.filter(({ success }) => !success),
      null,
      2
    )
  );
  writeFileSync(outputPathAllJson, JSON.stringify(results, null, 2));
}

(async () => {
  console.log('Starting export process');
  // TODO: ask user if they want to continue
  const users = await exportUsers();
  // TODO: ask user if they want to continue
  await updateUsersInJetstreamDatabase(users);
  console.log('Done');
})();
