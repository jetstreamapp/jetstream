#!/usr/bin/env node
/**
 * Scaffold a new release-note MDX file under apps/docs/release-notes/ using
 * the current package.json version, today's date, and `git log` subjects since
 * the last tag to pre-populate highlights. Hand-edit the result before committing.
 *
 * Run: yarn new-release-note
 */
import { $, chalk, fs, path } from 'zx';

$.verbose = false;

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'apps/docs/release-notes');

const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const today = new Date().toISOString().slice(0, 10);
const fileName = `${today}-v${version}.mdx`;
const outputPath = path.join(OUTPUT_DIR, fileName);

if (await fs.pathExists(outputPath)) {
  console.error(chalk.red(`File already exists: ${path.relative(ROOT, outputPath)}`));
  process.exit(1);
}

let commitLines = [];
try {
  const lastTag = (await $`git describe --tags --abbrev=0 --match "v*"`).stdout.trim();
  const log = (await $`git log --pretty=format:%s ${lastTag}..HEAD`).stdout.trim();
  commitLines = log
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(feat|fix)(\(|:)/i.test(line));
} catch (error) {
  console.log(chalk.yellow('Could not read git log since last tag; leaving highlights blank.'));
}

const highlightsYaml = commitLines.length
  ? commitLines.map((line) => `  - title: ${JSON.stringify(stripConventionalPrefix(line))}`).join('\n')
  : '  - title: "TODO — write a user-visible highlight"';

const scaffold = `---
slug: v${version}
title: "${version} — TODO short description"
date: '${today}'
authors: [jetstream]
tags: [web]
versions:
  web: ${version}
summary: TODO — one-to-two sentence summary for the in-app popover.
highlights:
${highlightsYaml}
---

## What's new

TODO — full release notes body rendered on the docs site.
`;

await fs.ensureDir(OUTPUT_DIR);
await fs.writeFile(outputPath, scaffold);

console.log(chalk.greenBright(`Created ${path.relative(ROOT, outputPath)}`));
console.log(chalk.cyan('Edit the frontmatter + body, then run: yarn release-notes:generate'));

function stripConventionalPrefix(line) {
  return line.replace(/^(feat|fix|chore|docs|refactor|perf|test|build|ci)(\([^)]+\))?!?:\s*/i, '').trim();
}
