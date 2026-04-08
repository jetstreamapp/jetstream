#!/usr/bin/env zx

import 'zx/globals';

dotenv.config('.env');
dotenv.config('.env.local');

const SCRATCH_DEF = 'config/project-scratch-def.json';
const ORG_ALIAS = 'scratch';
const PERMISSION_SETS = ['Jetstream'];

console.log(chalk.blue('Creating scratch org...'));
$.verbose = true;
await $`sf org create scratch --definition-file ${SCRATCH_DEF} --set-default --alias ${ORG_ALIAS}`;
console.log(chalk.green('Scratch org created successfully.'));

console.log(chalk.blue('Deploying source...'));
await $`sf project deploy start`;
console.log(chalk.green('Source deployed.'));

for (const permSet of PERMISSION_SETS) {
  console.log(chalk.blue(`Assigning permission set: ${permSet}`));
  await $`sf org assign permset --name ${permSet}`;
}
console.log(chalk.green('Permission sets assigned.'));

console.log(chalk.blue('Generating password...'));
await $`sf org generate password --complexity=3`;
await $`sf org display user`;

console.log(chalk.green('Scratch org setup complete!'));

await $`sf org open`;
