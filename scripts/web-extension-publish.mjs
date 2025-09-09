#!/usr/bin/env node
import 'dotenv/config';
import minimist from 'minimist';
import { join } from 'path';
import { z } from 'zod';
import { chalk, fs, question } from 'zx'; // https://github.com/google/zx

const ENV = z
  .object({
    CLIENT_ID: z.string().min(1),
    CLIENT_SECRET: z.string().min(1),
    REFRESH_TOKEN: z.string().min(1),
    EXTENSION_ID: z.string().min(1),
  })
  .parse({
    CLIENT_ID: process.env.GOOGLE_WEB_EXT_PUBLISH_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_WEB_EXT_PUBLISH_CLIENT_SECRET,
    REFRESH_TOKEN: process.env.GOOGLE_WEB_EXT_PUBLISH_REFRESH_TOKEN,
    EXTENSION_ID: process.env.WEB_EXTENSION_ID_CHROME,
  });

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
    node scripts/web-extension-publish.mjs --status

    To upload an extension:
    node scripts/web-extension-publish.mjs --upload -f dist/jetstream-web-extension-v.0.0.1.zip

    To upload and publish an extension:
    node scripts/web-extension-publish.mjs --upload --publish -f dist/jetstream-web-extension-v.0.0.1.zip

    To publish a previously uploaded extension:
    node scripts/web-extension-publish.mjs --publish

    Options:
      -u, --upload            Upload extension to the web store (default=true)
      -p, --publish           Publish extension to the web store (default=false)
      -f, --filepath <path>    Path to the extension zip file (required if --upload is set, otherwise not allowed)
      -s, --check-status      Get the status of the extension, if set no other operation will be performed
          --accept-all        Say yes to all prompts (default=false)
      -h, --help              display help for command

    Required Environment variables:
      GOOGLE_WEB_EXT_PUBLISH_CLIENT_ID
      GOOGLE_WEB_EXT_PUBLISH_CLIENT_SECRET
      GOOGLE_WEB_EXT_PUBLISH_REFRESH_TOKEN
      WEB_EXTENSION_ID_CHROME
      (TODO: Mozilla support)
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

// https://developer.chrome.com/docs/webstore/api
class GoogleClient {
  /**
   * @type {string | null}
   */
  accessToken = null;

  async getAccessToken() {
    console.log('Getting access token...');
    this.accessToken = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: ENV.CLIENT_ID,
        client_secret: ENV.CLIENT_SECRET,
        refresh_token: ENV.REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }).toString(),
    })
      .then((res) => {
        if (!res.ok) {
          console.error(res.status);
          throw new Error('Failed to get access token');
        }
        return res.json();
      })
      .then((res) => res.access_token);
  }

  async checkStatus() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Checking status...');

    // https://developer.chrome.com/docs/webstore/api#get
    const response = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${ENV.EXTENSION_ID}?projection=DRAFT`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'x-goog-api-version': '2',
      },
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Failed to get extension status');
    }

    const body = await response.json();
    console.log(body);
  }

  async uploadExtension(filePath) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Uploading...');

    // https://developer.chrome.com/docs/webstore/api#update
    const response = await fetch(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${ENV.EXTENSION_ID}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'x-goog-api-version': '2',
      },
      body: fs.readFileSync(filePath),
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Failed to publish extension');
    }

    const body = await response.json();
    console.log(body);
  }

  async publishExtension() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    console.log('Publishing...');

    // https://developer.chrome.com/docs/webstore/api#publish
    const response = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${ENV.EXTENSION_ID}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'x-goog-api-version': '2',
      },
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Failed to get extension status');
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

main();
