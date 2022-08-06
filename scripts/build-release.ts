#!/usr/bin/env node
import 'dotenv/config';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import { $, chalk, fs, path, argv, cd } from 'zx'; // https://github.com/google/zx
import * as JSZip from 'jszip';

const gitRevisionPlugin = new GitRevisionPlugin();

/**
 * Script to generate a new package version
 * [WIP]
 */

void (async function () {
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
      fs.removeSync(file);
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
    `dist/apps/landing/exported`,
  ];

  await $`zip -r dist/release-${version}.zip ${filesToZip}`;

  // unrelated to this script
  // build electron application - should be auto-added to github release
})();
