#!/usr/bin/env node
import 'dotenv/config';
import { $, chalk, fs, path } from 'zx'; // https://github.com/google/zx

void (async function () {
  const htmlDocument = fs.readFileSync(path.join(__dirname, '../dist/apps/docs/index.html'), 'utf8');
  const scriptText = htmlDocument.match(/\<script\>function gtag.+\<\/script\>/)[0].replace(/<script>|<\/script>/g, '');
  const scriptText2 = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}if(window.location.hostname!=='localhost'){gtag('js', new Date());gtag('config', 'G-GZJ9QQTK44');}`;

  $.verbose = false;

  console.log(chalk.blue('HASHING SCRIPT'), chalk.yellow(scriptText));
  console.log(chalk.blue('HASHING SCRIPT'), chalk.yellow(scriptText2));

  const output = await $`echo -n ${scriptText} | openssl sha256 -binary | openssl base64`;
  console.log(chalk.greenBright(`sha256-${output.stdout}`));

  const output2 = await $`echo -n ${scriptText2} | openssl sha256 -binary | openssl base64`;
  console.log(chalk.greenBright(`sha256-${output2.stdout}`));
})();
