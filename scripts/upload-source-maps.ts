#!/usr/bin/env node
import 'dotenv/config';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import { $, chalk, fs, path } from 'zx'; // https://github.com/google/zx

const gitRevisionPlugin = new GitRevisionPlugin();

/**
 * Script to generate a new package version
 * [WIP]
 */

void (async function () {
  console.log(chalk.blue('Uploading sourcemaps to Rollbar'));
  const url = 'https://api.rollbar.com/api/1/sourcemap';
  const accessToken = process.env.ROLLBAR_SERVER_TOKEN;
  const distPath = path.join(__dirname, '../dist/apps/jetstream');

  if (!accessToken) {
    console.error(chalk.redBright('🚫 COULD NOT UPLOAD SOURCEMAPS - ACCESS TOKEN NOT SET 🚫'));
    return;
  }

  $.verbose = false;
  console.time();
  const files = (await fs.readdir(distPath)).filter((item) => item.endsWith('.js.map')).sort();

  for (const file of files) {
    try {
      const filePath = path.join(distPath, file);
      const minifiedUrl = `//dynamichost/${file.replace('.js.map', '.js')}`;

      console.log(chalk.blue(`- ${file}`));

      await $`curl ${url} -F access_token=${accessToken} -F version=${gitRevisionPlugin.version()} -F minified_url=${minifiedUrl} -F source_map=@${filePath}`;
    } catch (ex) {
      console.error(chalk.redBright('🚫 Error uploading sourcemap', ex.message));
    }
  }
  console.timeEnd();
})();
