#!/usr/bin/env node
import 'dotenv/config';
import { $, chalk, fs, path } from 'zx'; // https://github.com/google/zx

/**
 * Script to generate a new package version
 * [WIP]
 */

if (process.env.SKIP_ROLLBAR) {
  console.log(chalk.yellow('Skipping Rollbar asset upload'));
  return;
}
console.log(chalk.blue(`Uploading sourcemaps to Rollbar`));
const distPath = path.join(__dirname, '../dist');
const version = (fs.readFileSync(path.join(distPath, 'VERSION'), 'utf8') || (await $`git describe --always`).stdout).trim();
const url = 'https://api.rollbar.com/api/1/sourcemap';
const accessToken = process.env.ROLLBAR_SERVER_TOKEN;

console.log(chalk.blue(`Version: ${version}`));

if (!accessToken) {
  console.error(chalk.redBright('🚫 COULD NOT UPLOAD SOURCEMAPS - ACCESS TOKEN NOT SET 🚫'));
  return;
}

$.verbose = false;
console.time();
/**
 * CLIENT SOURCEMAPS
 */
for (const sourceMapPath of [path.join(distPath, 'apps/jetstream'), path.join(distPath, 'apps/download-zip-sw')]) {
  console.log(sourceMapPath);
  const files = (await fs.readdir(sourceMapPath)).filter((item) => item.endsWith('.js.map')).sort();

  for (const file of files) {
    try {
      const filePath = path.join(sourceMapPath, file);
      const minifiedUrl = `//dynamichost/${file.replace('.js.map', '.js')}`;

      console.log(chalk.blue(`- ${file}`));

      await $`curl ${url} -F access_token=${accessToken} -F version=${version} -F minified_url=${minifiedUrl} -F source_map=@${filePath}`;
    } catch (ex: any) {
      console.error(chalk.redBright('🚫 Error uploading client sourcemap', ex.message));
    }
  }
}
/**
 * SERVER SOURCEMAPS
 */
for (const sourceMapPath of [path.join(distPath, 'apps/api')]) {
  console.log(sourceMapPath);
  const files = (await fs.readdir(sourceMapPath)).filter((item) => item.endsWith('.js.map')).sort();

  for (const file of files) {
    try {
      const filePath = path.join(sourceMapPath, file);
      const minifiedUrl = `/opt/render/project/src/dist/apps/api/${file.replace('.js.map', '.js')}`;

      console.log(chalk.blue(`- ${file}`));

      await $`curl ${url} -F access_token=${accessToken} -F version=${version} -F minified_url=${minifiedUrl} -F source_map=@${filePath}`;
    } catch (ex: any) {
      console.error(chalk.redBright('🚫 Error uploading server sourcemap', ex.message));
    }
  }
}
console.timeEnd();
