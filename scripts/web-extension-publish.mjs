#!/usr/bin/env node
import 'dotenv/config';
import minimist from 'minimist';
import { createSign } from 'node:crypto';
import { join } from 'path';
import { z } from 'zod';
import { chalk, fs, question } from 'zx'; // https://github.com/google/zx

// Authenticates with a Google Cloud service account (added to the item in the
// Chrome Web Store Developer Dashboard) against the Chrome Web Store v2 API.
// https://developer.chrome.com/docs/webstore/using-api
const ENV = z
  .object({
    SERVICE_ACCOUNT_KEY: z.string().min(1),
    EXTENSION_ID: z.string().min(1),
    PUBLISHER_ID: z.string().min(1),
  })
  .parse({
    SERVICE_ACCOUNT_KEY: process.env.GOOGLE_WEB_EXT_SERVICE_ACCOUNT_KEY,
    EXTENSION_ID: process.env.WEB_EXTENSION_ID_CHROME,
    PUBLISHER_ID: process.env.GOOGLE_WEB_EXT_PUBLISHER_ID,
  });

// Only the fields we need from the service account JSON key file. The key is
// passed as a single secret containing the whole JSON document.
const serviceAccount = z
  .object({
    client_email: z.string().min(1),
    private_key: z.string().min(1),
    token_uri: z.string().min(1).default('https://oauth2.googleapis.com/token'),
  })
  .parse(
    (() => {
      try {
        return JSON.parse(ENV.SERVICE_ACCOUNT_KEY);
      } catch {
        console.error(chalk.red('GOOGLE_WEB_EXT_SERVICE_ACCOUNT_KEY is not valid JSON'));
        process.exit(1);
      }
    })(),
  );

const CHROME_WEB_STORE_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const ITEM_NAME = `publishers/${ENV.PUBLISHER_ID}/items/${ENV.EXTENSION_ID}`;

const argv = minimist(process.argv.slice(2), {
  boolean: ['upload', 'publish', 'publish-public', 'check-status', 'accept-all', 'help'],
  string: ['filepath', 'publish-target'],
  default: {
    upload: false,
    publish: false,
    'check-status': false,
    'publish-public': false,
    help: false,
  },
  alias: {
    h: 'help',
    f: 'filepath',
    u: 'upload',
    p: 'publish',
    s: 'check-status',
  },
});

if (argv.help) {
  console.log(`
    Usage: web-extension-publish [options]

    To check extension status:
    node scripts/web-extension-publish.mjs --check-status

    To upload an extension:
    node scripts/web-extension-publish.mjs --upload -f dist/jetstream-web-extension-v.0.0.1.zip

    To upload and publish an extension:
    node scripts/web-extension-publish.mjs --upload --publish -f dist/jetstream-web-extension-v.0.0.1.zip

    To publish a previously uploaded extension:
    node scripts/web-extension-publish.mjs --publish

    Options:
      -u, --upload            Upload extension to the web store (default=false)
      -p, --publish           Publish extension to the web store (default=false)
      -f, --filepath <path>    Path to the extension zip file (required if --upload is set, otherwise not allowed)
      -s, --check-status      Get the status of the extension, if set no other operation will be performed
          --accept-all        Say yes to all prompts (default=false)
      -h, --help              display help for command

    Required Environment variables:
      GOOGLE_WEB_EXT_SERVICE_ACCOUNT_KEY  Full JSON key for a service account with access to the item
      WEB_EXTENSION_ID_CHROME             The item (extension) ID
      GOOGLE_WEB_EXT_PUBLISHER_ID         The Chrome Web Store publisher ID (Publisher > Settings)
  `);
  process.exit(0);
}

const acceptAll = argv['accept-all'];

if (!argv.upload && !argv.publish && !argv['check-status']) {
  console.error(chalk.red('At least one of --check-status, --upload or --publish must be set'));
  process.exit(1);
}

if (argv.upload && !argv.filepath) {
  console.error(chalk.red('--filepath is required when --upload is set'));
  process.exit(1);
}

if (!argv.upload && argv.filepath) {
  console.error(chalk.red('--filepath is not allowed when --upload is not set'));
  process.exit(1);
}

const statusSchema = z.object({
  'check-status': z.literal(true),
  upload: z.literal(false),
  publish: z.literal(false),
  filepath: z.string().nullish(),
});

const actionSchema = z.object({
  'check-status': z.literal(false),
  upload: z.boolean(),
  publish: z.boolean(),
  filepath: z.string().nullish(),
});

const typedArgs = z
  .discriminatedUnion('check-status', [statusSchema, actionSchema])
  .transform((val) => ({
    checkStatus: val['check-status'],
    upload: val.upload,
    publish: val.publish,
    filepath: val.upload ? val.filepath : null,
  }))
  .parse(argv);

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

// https://developer.chrome.com/docs/webstore/api
class GoogleClient {
  /**
   * @type {string | null}
   */
  accessToken = null;

  async parseApiError(response, fallbackMessage) {
    const bodyText = await response.text();

    try {
      const parsedBody = JSON.parse(bodyText);
      console.error(parsedBody);
    } catch {
      console.error(bodyText);
    }

    throw new Error(fallbackMessage);
  }

  /**
   * Mints a short-lived access token using the service account's signed JWT.
   * https://developers.google.com/identity/protocols/oauth2/service-account#httprest
   */
  async getAccessToken() {
    console.log('Getting access token...');

    const issuedAt = Math.floor(Date.now() / 1000);
    const claims = {
      iss: serviceAccount.client_email,
      scope: CHROME_WEB_STORE_SCOPE,
      aud: serviceAccount.token_uri,
      iat: issuedAt,
      exp: issuedAt + 3600,
    };

    const unsignedToken = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
    const signature = createSign('RSA-SHA256').update(unsignedToken).end().sign(serviceAccount.private_key).toString('base64url');
    const assertion = `${unsignedToken}.${signature}`;

    const response = await fetch(serviceAccount.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!response.ok) {
      await this.parseApiError(response, 'Failed to get access token');
    }

    const body = await response.json();
    this.accessToken = body.access_token;
  }

  async checkStatus() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Checking status...');

    // https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus
    const response = await fetch(`https://chromewebstore.googleapis.com/v2/${ITEM_NAME}:fetchStatus`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      await this.parseApiError(response, 'Failed to get extension status');
    }

    const body = await response.json();
    console.log(body);
  }

  async uploadExtension(filePath) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Uploading...');

    // https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/upload
    const response = await fetch(`https://chromewebstore.googleapis.com/upload/v2/${ITEM_NAME}:upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: fs.readFileSync(filePath),
    });

    if (!response.ok) {
      await this.parseApiError(response, 'Failed to upload extension');
    }

    const body = await response.json();
    console.log(body);
  }

  async publishExtension() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Publishing...');

    // https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
    const response = await fetch(`https://chromewebstore.googleapis.com/v2/${ITEM_NAME}:publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skipReview: false,
        blockOnWarnings: false,
      }),
    });

    if (!response.ok) {
      await this.parseApiError(response, 'Failed to publish extension');
    }

    const body = await response.json();
    console.log(body);
  }
}

async function main() {
  const { checkStatus, publish, upload, filepath } = typedArgs;

  const client = new GoogleClient();

  if (checkStatus) {
    await client.checkStatus();
    process.exit(0);
  }

  if (upload) {
    const zipFilePath = join(process.cwd(), `${filepath}`);

    if (!fs.existsSync(zipFilePath)) {
      console.error(chalk.red('Zipped extension not found'), zipFilePath);
      process.exit(1);
    }

    console.log('Extension path:', zipFilePath);
    const shouldContinue = acceptAll
      ? true
      : await question('Are you sure you want to upload the extension? (y/n) ').then((response) =>
          response.trim().toLowerCase().startsWith('y'),
        );

    if (!shouldContinue) {
      console.log('Aborting');
      process.exit(0);
    }

    await client.uploadExtension(filepath);
  }

  if (publish) {
    console.log(chalk.green(`Publishing extension...`));

    const shouldContinue = acceptAll
      ? true
      : await question('Are you sure you want to publish the extension? (y/n) ').then((response) =>
          response.trim().toLowerCase().startsWith('y'),
        );

    if (!shouldContinue) {
      console.log('Aborting');
      process.exit(0);
    }

    await client.publishExtension();
  }
}

main().catch((error) => {
  console.error(chalk.red(error instanceof Error ? error.message : error));
  process.exit(1);
});
