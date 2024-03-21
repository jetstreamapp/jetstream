#!/usr/bin/env node
import 'dotenv/config';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import { $, argv, chalk, fs } from 'zx'; // https://github.com/google/zx

const gitRevisionPlugin = new GitRevisionPlugin();

/**
 * Script to generate a new package version
 * [WIP]
 */

// build core application
// zip build
// release it
const version = argv.version;
console.log(chalk.green(`********** BUILDING FOR PRODUCTION v${version} **********`));
await $`SKIP_ROLLBAR=true yarn build`;

console.log(chalk.green('ZIPPING BUILD'));

// Delete all prior release zip files
fs.readdirSync('dist').forEach((file) => {
  if (file.endsWith('.zip')) {
    console.log('deleting ', file);
    fs.unlinkSync(`dist/${file}`);
  }
});

const filesToZip = [
  `.env.example`,
  `.gitignore`,
  `.prettierignore`,
  `.prettierrc`,
  `docker-compose.yml`,
  `Dockerfile.db-migration`,
  `Dockerfile`,
  `Dockerfile`,
  `ecosystem.config.js`,
  `package.json`,
  `prisma`,
  `README.md`,
  `scripts`,
  `yarn.lock`,
  `dist/apps/api`,
  `dist/apps/download-zip-sw`,
  `dist/apps/jetstream-worker`,
  `dist/apps/landing`,
];

await $`zip -r dist/release-${version}.zip ${filesToZip}`;
