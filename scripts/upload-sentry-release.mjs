#!/usr/bin/env node
import 'dotenv/config';
import { $, chalk, fs, path } from 'zx';

/**
 * Upload sourcemaps + create release record at Better Stack (Sentry-compatible API).
 *
 * Required env vars (all read natively by sentry-cli):
 *   SENTRY_AUTH_TOKEN — Better Stack API token (account-wide, not project-scoped)
 *   SENTRY_URL        — Better Stack ingestion base URL (e.g. https://s1573619.us-east-9.betterstackdata.com/)
 *   SENTRY_ORG        — Better Stack org slug
 *   SENTRY_PROJECT    — Better Stack project slug (the FRONTEND project — we only upload web sourcemaps)
 *
 * See: https://betterstack.com/docs/errors/using-the-product/releases/
 */

const requiredEnv = ['SENTRY_AUTH_TOKEN', 'SENTRY_URL', 'SENTRY_ORG', 'SENTRY_PROJECT'];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(chalk.redBright(`🚫 Missing required env var(s): ${missing.join(', ')} — cannot upload release`));
  process.exit(1);
}

const distPath = path.join(__dirname, '../dist');
const version = (fs.readFileSync(path.join(distPath, 'VERSION'), 'utf8') || (await $`git describe --always`).stdout).trim();

console.log(chalk.blue(`Better Stack release: ${version}`));

// sentry-cli picks up SENTRY_AUTH_TOKEN / SENTRY_URL / SENTRY_ORG / SENTRY_PROJECT from the environment
const sentry = (...args) => $`yarn sentry-cli ${args}`;

console.time('release-upload');

await sentry('releases', 'new', version);

const clientDist = path.join(distPath, 'apps/jetstream');
if (!fs.existsSync(clientDist)) {
  console.error(chalk.redBright(`🚫 Client build not found at ${clientDist}`));
  process.exit(1);
}

console.log(chalk.blue(`Uploading client sourcemaps from ${clientDist}`));
await sentry('releases', 'files', version, 'upload-sourcemaps', clientDist, '--url-prefix', '~/', '--rewrite');

await sentry('releases', 'finalize', version);
await sentry('releases', 'deploys', version, 'new', '-e', 'production');

// Strip sourcemaps from the deployed bundle so they're only accessible via Better Stack.
// `sourcemap: 'hidden'` in vite.config.ts already omits the sourceMappingURL comment.
const mapFiles = await fs.promises.readdir(clientDist, { recursive: true });
let removed = 0;
for (const relPath of mapFiles) {
  if (relPath.endsWith('.js.map')) {
    await fs.promises.rm(path.join(clientDist, relPath));
    removed++;
  }
}
console.log(chalk.blue(`Removed ${removed} sourcemap file(s) from ${clientDist}`));

console.timeEnd('release-upload');
console.log(chalk.green(`✅ Better Stack release ${version} uploaded`));
