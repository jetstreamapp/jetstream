#!/usr/bin/env node
import 'dotenv/config';
import minimist from 'minimist';
import { join } from 'path';
import webExt from 'web-ext';
import { z } from 'zod';
import { chalk, fs } from 'zx';

const ENV = z
  .object({
    MOZ_JWT_ISSUER: z.string().min(1),
    MOZ_JWT_SECRET: z.string().min(1),
  })
  .parse({
    MOZ_JWT_ISSUER: process.env.MOZ_JWT_ISSUER,
    MOZ_JWT_SECRET: process.env.MOZ_JWT_SECRET,
  });

const argv = minimist(process.argv.slice(2), {
  boolean: ['help'],
  string: ['channel'],
  default: {
    channel: 'listed',
    help: false,
  },
  alias: {
    h: 'help',
    c: 'channel',
  },
});

if (argv.help) {
  console.log(`
    Usage: web-extension-publish-firefox [options]

    Submits the already-built web extension to Mozilla Add-ons (AMO) for signing
    and (for the "listed" channel) review/publication.

    Build the extension and create the zips first:
      pnpm build:web-extension
      pnpm build:web-extension:zip

    Then publish:
      node scripts/web-extension-publish-firefox.mjs --channel listed

    Options:
      -c, --channel <channel>  AMO channel: "listed" (public store) or "unlisted"
                               (self-hosted signing only). Default: listed
      -h, --help               display help for command

    Required environment variables:
      MOZ_JWT_ISSUER   API key (JWT issuer) from addons.mozilla.org
      MOZ_JWT_SECRET   API secret (JWT secret) from addons.mozilla.org
  `);
  process.exit(0);
}

const channel = argv.channel;
if (channel !== 'listed' && channel !== 'unlisted') {
  console.error(chalk.red(`Invalid --channel "${channel}". Must be "listed" or "unlisted".`));
  process.exit(1);
}

const SOURCE_DIR = join(process.cwd(), 'dist/apps/jetstream-web-extension');
const ARTIFACTS_DIR = join(process.cwd(), 'dist/web-extension-build');
// Source archive produced by scripts/web-extension-zip.mjs. AMO requires the
// human-readable source because our build output is bundled/minified by Vite.
const SOURCE_ZIP = join(ARTIFACTS_DIR, 'web-extension-source.zip');

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(chalk.red('Built extension not found.'), SOURCE_DIR);
  console.error(chalk.yellow('Run `pnpm build:web-extension` first.'));
  process.exit(1);
}

if (!fs.existsSync(SOURCE_ZIP)) {
  console.error(chalk.red('Source archive not found.'), SOURCE_ZIP);
  console.error(chalk.yellow('Run `pnpm build:web-extension:zip` first.'));
  process.exit(1);
}

async function main() {
  console.log(chalk.green(`Signing and submitting Firefox extension to AMO (channel: ${channel})...`));

  const result = await webExt.cmd.sign(
    {
      amoBaseUrl: 'https://addons.mozilla.org/api/v5/',
      apiKey: ENV.MOZ_JWT_ISSUER,
      apiSecret: ENV.MOZ_JWT_SECRET,
      sourceDir: SOURCE_DIR,
      artifactsDir: ARTIFACTS_DIR,
      channel,
      uploadSourceCode: SOURCE_ZIP,
    },
    {
      // Resolve the promise instead of calling process.exit so we control the flow.
      shouldExitProgram: false,
    },
  );

  if (!result || result.success === false) {
    console.error(chalk.red('Failed to sign/submit the Firefox extension.'));
    process.exit(1);
  }

  console.log(chalk.green('✅ Submitted to AMO.'));
  if (Array.isArray(result.downloadedFiles) && result.downloadedFiles.length > 0) {
    console.log(chalk.blue('Signed artifacts:'), result.downloadedFiles);
  }
}

main();
