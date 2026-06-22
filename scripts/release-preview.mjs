#!/usr/bin/env node

/**
 * Preview commits that would be included in the next web release.
 *
 * Shows the commit list between a base release tag and the current HEAD,
 * grouped into merged PRs and direct commits. Defaults the base to the
 * most recent v* (web) tag; pass --base to override, or --path to filter to
 * a specific pathspec (e.g. `--path apps/jetstream/`).
 *
 * Usage:
 *   node scripts/release-preview.mjs [--base <tag>] [--path <pathspec>]
 */

import { select } from '@inquirer/prompts';
import { chalk } from 'zx';
import { fetchTags, getMergedPrsSince, listWebTags, refExists, REPO_SLUG } from './lib/gather-prs.mjs';

// ── Args ───────────────────────────────────────────────────────────────────
const options = parseArgs(process.argv.slice(2));

console.log('\n' + chalk.bold.cyan('  Release Preview') + '\n');

// ── Fetch tags ─────────────────────────────────────────────────────────────
process.stdout.write(chalk.dim('Fetching tags... '));
console.log((await fetchTags()) ? chalk.green('done') : chalk.yellow('skipped (offline?)'));

// ── Determine base tag ─────────────────────────────────────────────────────
let baseTag = options.base;

if (!baseTag) {
  const webTags = await listWebTags();
  if (webTags.length === 0) {
    console.error(chalk.red('\nNo v* tags found in this repo.\n'));
    process.exit(1);
  }
  baseTag = await select({
    message: 'Base release tag',
    choices: webTags.slice(0, 10).map((tag) => ({ value: tag, name: tag })),
    default: webTags[0],
  });
}

// ── Validate base tag ──────────────────────────────────────────────────────
if (!(await refExists(baseTag))) {
  console.error(chalk.red(`\nBase tag "${baseTag}" not found.\n`));
  process.exit(1);
}

const { baseSha, currentBranch, headSha, prs, directCommits, mainlineCommits, totalCommits } = await getMergedPrsSince(baseTag, {
  path: options.path,
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log('');
console.log(chalk.bold('  Summary'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('base')}     ${chalk.cyan(baseTag)} ${chalk.dim(`(${baseSha.slice(0, 9)})`)}`);
console.log(`  ${chalk.dim('head')}     ${chalk.cyan(currentBranch)} ${chalk.dim(`(${headSha.slice(0, 9)})`)}`);
if (options.path) {
  console.log(`  ${chalk.dim('path')}     ${chalk.cyan(options.path)}`);
}
console.log(`  ${chalk.dim('commits')}  ${chalk.cyan(String(totalCommits))} ${chalk.dim(`(${mainlineCommits.length} on mainline)`)}`);
console.log(`  ${chalk.dim('PRs')}      ${chalk.cyan(String(prs.length))}`);
console.log('');

if (totalCommits === 0) {
  console.log(chalk.yellow('  No commits between base and HEAD.'));
  if (options.path) {
    console.log(chalk.dim('  (Try running without --path filter.)'));
  }
  console.log('');
  process.exit(0);
}

// ── PR list ────────────────────────────────────────────────────────────────
if (prs.length > 0) {
  console.log(chalk.bold('  Merged PRs'));
  console.log(chalk.dim('  ─────────────────────────'));
  const numberWidth = Math.max(...prs.map((pr) => pr.number.length));
  for (const pr of prs) {
    const padded = `#${pr.number}`.padEnd(numberWidth + 1);
    console.log(`  ${chalk.cyan(padded)}  ${pr.label}`);
  }
  console.log('');
}

// ── Direct commits ─────────────────────────────────────────────────────────
if (directCommits.length > 0) {
  console.log(chalk.bold('  Direct commits'));
  console.log(chalk.dim('  ─────────────────────────'));
  for (const commit of directCommits) {
    console.log(`  ${chalk.dim(commit.short)}  ${commit.subject}`);
  }
  console.log('');
}

// ── GitHub compare link ────────────────────────────────────────────────────
const compareUrl = `https://github.com/${REPO_SLUG}/compare/${baseTag}...${headSha}`;
console.log(`  ${chalk.dim('compare')}  ${chalk.underline.blue(compareUrl)}`);
console.log('');

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs(args) {
  const result = { base: null, path: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base' || arg === '-b') {
      result.base = args[++i];
    } else if (arg === '--path' || arg === '-p') {
      result.path = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/release-preview.mjs [options]

Options:
  --base, -b <tag>    Base release tag to compare against (default: prompt with latest v* tags)
  --path, -p <spec>   Path filter (e.g. "apps/jetstream/" to scope to the web app)
  --help, -h          Show this help
`);
      process.exit(0);
    } else {
      console.error(chalk.red(`Unknown argument: ${arg}`));
      process.exit(1);
    }
  }
  return result;
}
