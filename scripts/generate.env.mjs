#!/usr/bin/env node
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { chalk, fs, path, question } from 'zx'; // https://github.com/google/zx

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFilename = path.join(__dirname, '../.env.example');
const outputFilename = path.join(__dirname, '../.env');

function generateRandomBase64(size = 32) {
  return crypto.randomBytes(size).toString('base64');
}

const exampleEnvFile = fs.readFileSync(inputFilename, 'utf8');

// check if .env file exists, if so ask the user if they want to overwrite it or abort
if (fs.existsSync(inputFilename)) {
  console.log(chalk.yellow(`.env file already exists.`));
  const response = await question('Overwrite? (y/N)? ');
  if (!response || response.toLocaleLowerCase() !== 'y') {
    console.log(chalk.redBright('Aborting'));
    process.exit(1);
  }
}

const clientUrl = await question('Are you going to developing on the codebase (determines ports to use)? (y/N) ').then((response) =>
  (response || '').toLocaleLowerCase() === 'y' ? 'http://localhost:4200/app' : 'http://localhost:3333/app'
);

console.log(chalk.green('Client url set to:'), clientUrl);

const enableExampleUser = await question('Would you like to enable the example user? (Y/n) ').then((response) =>
  !response || (response || '').toLocaleLowerCase() === 'y' ? 'true' : 'false'
);

const replacements = [
  ['JETSTREAM_CLIENT_URL=', `JETSTREAM_CLIENT_URL='${clientUrl}'`],
  ['NX_PUBLIC_CLIENT_URL=', `NX_PUBLIC_CLIENT_URL='${clientUrl}'`],
  ['JETSTREAM_SESSION_SECRET=', `JETSTREAM_SESSION_SECRET='${generateRandomBase64(32)}'`],
  ['JETSTREAM_AUTH_SECRET=', `JETSTREAM_AUTH_SECRET='${generateRandomBase64(32)}'`],
  ['JETSTREAM_AUTH_OTP_SECRET=', `JETSTREAM_AUTH_OTP_SECRET='${generateRandomBase64(32)}'`],
  ['EXAMPLE_USER_OVERRIDE=', `EXAMPLE_USER_OVERRIDE='${enableExampleUser}'`],
];

// for each line in file, see if line starts with a replacement string
// if it does, replace it with the new value
const newEnvFile = exampleEnvFile
  .split('\n')
  .map((line) => {
    const replacement = replacements.find(([search]) => line.startsWith(search));
    if (replacement) {
      return replacement[1];
    }
    return line;
  })
  .join('\n');

// Ensure the file is valid
const parsedEnvFile = dotenv.parse(Buffer.from(newEnvFile));

if (enableExampleUser === 'true') {
  console.log(chalk.green('\nExample user Credentials:'));
  console.log(chalk.greenBright('test@example.com'));
  console.log(chalk.greenBright(parsedEnvFile.EXAMPLE_USER_PASSWORD));
}

console.log(
  chalk.yellowBright(`
You need to manually populate the following values in your .env file:

${chalk.greenBright(`Create a connected app in Salesforce with OAuth enabled`)}
${chalk.greenBright(`Use the scopes: profile email openid api refresh_token offline_access`)}
${chalk.greenBright(`Get the client id and client secret and use for the following values:`)}

SFDC_CONSUMER_KEY="YOUR_SFDC_CONSUMER_KEY"
SFDC_CONSUMER_SECRET="YOUR_SFDC_CONSUMER_SECRET"

AUTH_SFDC_CLIENT_ID="YOUR_SFDC_CONSUMER_KEY"
AUTH_SFDC_CLIENT_SECRET="YOUR_SFDC_CONSUMER_SECRET"

${chalk.greenBright(`If you want to enable login with Google, you will need to create a project in the Google Developer Console`)}
${chalk.greenBright(`And populate these values:`)}
AUTH_GOOGLE_CLIENT_ID
AUTH_GOOGLE_CLIENT_SECRET
`)
);

fs.writeFileSync(outputFilename, newEnvFile);
