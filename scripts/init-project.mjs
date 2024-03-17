#!/usr/bin/env node

import { chalk, fs, path, question } from 'zx'; // https://github.com/google/zx

console.log(chalk.blue(`Initializing project`));

console.log(chalk.blue(`Copying .env.example to .env`));

const envPath = path.join(__dirname, '../.env');
const envTempPath = path.join(__dirname, '../.env.example');

if (fs.existsSync(envPath)) {
  const answer = await question(chalk.yellow(`.env file already exists, would you like to overwrite it?`), { choices: ['Y', 'N'] });
  if (!(answer || '').toLowerCase().startsWith('y')) {
    process.exit(0);
  }
}

fs.copyFileSync(envTempPath, envPath);
