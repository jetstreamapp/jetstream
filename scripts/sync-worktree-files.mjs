#!/usr/bin/env node

/**
 * Copy local, gitignored files (.env, code-signing assets, …) from one worktree to the others.
 *
 * Git never syncs these files because they are not tracked, so every new worktree starts without
 * them and any edit to one worktree's copy leaves the rest stale. This script pushes the files
 * from the worktree you are standing in to the other registered worktrees, showing exactly what
 * would be created or overwritten before it touches anything.
 *
 * Files that git already tracks are skipped when a directory is synced — those are branch content
 * and belong to git, not to this script (use --include-tracked to force them). Symlinks are skipped
 * on both sides: never followed when reading, never written through when copying.
 *
 * Usage:
 *   pnpm worktree:sync                          # .env + build-resources -> every other worktree
 *   pnpm worktree:sync .env                     # just .env
 *   pnpm worktree:sync --to workspace-8         # seed a freshly created worktree
 *   pnpm worktree:sync --from jetstream         # pull from the main checkout instead of pushing
 *   pnpm worktree:sync --dry-run --diff         # preview, with a diff of everything it would clobber
 *   pnpm worktree:sync --yes                    # no confirmation prompt
 */

import { confirm } from '@inquirer/prompts';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { $, chalk } from 'zx';

$.verbose = false;

/** Synced when no paths are passed on the command line. Relative to the worktree root. */
const DEFAULT_PATHS = ['.env', 'build-resources'];

/** Never descended into or copied when a directory is synced. */
const ALWAYS_IGNORED = new Set(['.git', 'node_modules', '.DS_Store']);

function die(message) {
  console.error(chalk.red(`\n${message}\n`));
  process.exit(1);
}

function printHelp() {
  console.log(`Copy local, gitignored files from one worktree to the others.

Usage: pnpm worktree:sync [paths...] [options]

Paths are relative to the worktree root. Defaults to: ${DEFAULT_PATHS.join(', ')}
Directories are copied recursively, skipping anything git tracks. Symlinks are never followed.

Options:
  --to <name|path>    Sync only to this worktree (repeatable; default: all other worktrees)
  --from <name|path>  Worktree to copy from (default: the one you are in)
  --dry-run           Report what would change without copying anything
  --diff              Show a diff for every file that would be overwritten
  --include-tracked   Also copy git-tracked files found inside a synced directory
  -y, --yes           Skip the confirmation prompt
  -h, --help          Show this help

Examples:
  pnpm worktree:sync                       # push .env + build-resources everywhere
  pnpm worktree:sync .env --diff           # review .env drift before overwriting it
  pnpm worktree:sync --to workspace-8      # seed a brand new worktree
`);
}

function parseArgs(argv) {
  const options = { paths: [], to: [], from: null, dryRun: false, diff: false, includeTracked: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--to' || arg === '--from') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        die(`${arg} requires a worktree name or path`);
      }
      if (arg === '--to') {
        options.to.push(value);
      } else {
        options.from = value;
      }
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--diff') {
      options.diff = true;
    } else if (arg === '--include-tracked') {
      options.includeTracked = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg.startsWith('-')) {
      die(`Unknown option: ${arg}\nRun \`pnpm worktree:sync --help\` for usage.`);
    } else {
      options.paths.push(arg);
    }
  }
  if (options.paths.length === 0) {
    options.paths = [...DEFAULT_PATHS];
  }
  return options;
}

/** Resolve symlinks so worktree paths from different sources compare equal. */
function canonical(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

async function listWorktrees() {
  const output = (await $`git worktree list --porcelain`).stdout;
  const worktrees = [];
  let current = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), branch: null };
      worktrees.push(current);
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === 'detached' && current) {
      current.branch = 'detached HEAD';
    }
  }
  return worktrees.map((worktree) => ({ ...worktree, name: basename(worktree.path), key: canonical(worktree.path) }));
}

function resolveWorktree(identifier, worktrees) {
  const byName = worktrees.filter(({ name }) => name === identifier);
  if (byName.length === 1) {
    return byName[0];
  }
  const key = canonical(identifier);
  const byPath = worktrees.find((worktree) => worktree.key === key);
  if (byPath) {
    return byPath;
  }
  const known = worktrees.map(({ name }) => `  ${name}`).join('\n');
  die(`No worktree matches "${identifier}". Known worktrees:\n${known}`);
}

/**
 * Collect the regular files under `relativePath`.
 *
 * Symlinks are never followed: a symlinked directory would pull an arbitrary tree from outside the
 * worktree into the copy (and a link cycle would recurse forever), and a dangling one would throw.
 * The destination side refuses to write through symlinks too, so the policy is the same both ways.
 */
function walkFiles(rootDir, relativePath, collected, skippedLinks) {
  const absolutePath = join(rootDir, relativePath);
  const stats = lstatSync(absolutePath);

  if (stats.isSymbolicLink()) {
    skippedLinks.push({ relativePath, reason: `symlink -> ${readlinkSync(absolutePath)}` });
    return;
  }
  if (stats.isFile()) {
    collected.push(relativePath);
    return;
  }
  if (!stats.isDirectory()) {
    skippedLinks.push({ relativePath, reason: 'not a regular file' });
    return;
  }

  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    if (ALWAYS_IGNORED.has(entry.name)) {
      continue;
    }
    walkFiles(rootDir, join(relativePath, entry.name), collected, skippedLinks);
  }
}

/** Expand the requested paths into a concrete file list, minus anything git already tracks. */
async function collectFiles(sourceWorktree, requestedPaths, includeTracked) {
  const rootDir = sourceWorktree.path;
  const files = [];
  const missing = [];
  const skippedLinks = [];

  for (const requestedPath of requestedPaths) {
    const absolutePath = resolve(rootDir, requestedPath);
    if (absolutePath !== rootDir && !absolutePath.startsWith(rootDir + sep)) {
      die(`"${requestedPath}" resolves outside of ${rootDir}`);
    }
    const relativePath = absolutePath.slice(rootDir.length + 1);
    if (!lstatSafe(absolutePath)) {
      missing.push(relativePath);
      continue;
    }
    walkFiles(rootDir, relativePath, files, skippedLinks);
  }

  if (includeTracked || files.length === 0) {
    return { files, missing, skippedLinks, trackedSkipped: [] };
  }

  const tracked = new Set((await $`git -C ${rootDir} ls-files -z -- ${requestedPaths}`).stdout.split('\0').filter(Boolean));
  return {
    files: files.filter((relativePath) => !tracked.has(relativePath)),
    missing,
    skippedLinks,
    trackedSkipped: files.filter((relativePath) => tracked.has(relativePath)),
  };
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Each source file is compared against every target, so hash it at most once per run. */
const sourceHashes = new Map();
function sourceHash(path) {
  if (!sourceHashes.has(path)) {
    sourceHashes.set(path, hashFile(path));
  }
  return sourceHashes.get(path);
}

function planForTarget(sourceWorktree, targetWorktree, files) {
  return files.map((relativePath) => {
    const sourceFile = join(sourceWorktree.path, relativePath);
    const targetFile = join(targetWorktree.path, relativePath);
    const entry = { relativePath, sourceFile, targetFile, targetName: targetWorktree.name };
    const targetStats = lstatSafe(targetFile);
    if (!targetStats) {
      return { ...entry, status: 'create' };
    }
    if (targetStats.isSymbolicLink()) {
      return { ...entry, status: 'skip', reason: `symlink -> ${readlinkSync(targetFile)}` };
    }
    if (targetStats.isDirectory()) {
      return { ...entry, status: 'skip', reason: 'a directory exists at this path' };
    }
    if (sourceHash(sourceFile) === hashFile(targetFile)) {
      return { ...entry, status: 'unchanged' };
    }
    return { ...entry, status: 'overwrite', modified: statSync(targetFile).mtime.toISOString().slice(0, 16).replace('T', ' ') };
  });
}

function lstatSafe(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function copyFile({ sourceFile, targetFile }) {
  mkdirSync(dirname(targetFile), { recursive: true });
  copyFileSync(sourceFile, targetFile);
  chmodSync(targetFile, statSync(sourceFile).mode & 0o777);
}

// ── Resolve source and targets ─────────────────────────────────────────────
const options = parseArgs(process.argv.slice(2));

const worktrees = await listWorktrees();
const currentRoot = (await $`git rev-parse --show-toplevel`).stdout.trim();
const source = options.from ? resolveWorktree(options.from, worktrees) : resolveWorktree(currentRoot, worktrees);

const requestedTargets = options.to.length > 0 ? options.to.map((identifier) => resolveWorktree(identifier, worktrees)) : worktrees;
const targets = requestedTargets.filter((worktree) => {
  if (worktree.key === source.key) {
    return false;
  }
  if (!existsSync(worktree.path)) {
    console.log(chalk.yellow(`Skipping ${worktree.name} — directory is missing (run \`git worktree prune\`)`));
    return false;
  }
  return true;
});

if (targets.length === 0) {
  die('No target worktrees to sync to.');
}

// ── Build the file list ────────────────────────────────────────────────────
const { files, missing, skippedLinks, trackedSkipped } = await collectFiles(source, options.paths, options.includeTracked);

console.log('\n' + chalk.bold.cyan('  Worktree file sync') + '\n');
console.log(`${chalk.bold('Source:')} ${source.name} ${chalk.dim(`(${source.branch ?? 'unknown branch'})`)}`);
console.log(`${chalk.bold('Files: ')} ${files.length > 0 ? files.join(', ') : chalk.dim('none')}`);
for (const relativePath of missing) {
  console.log(chalk.yellow(`  ! ${relativePath} does not exist in ${source.name} — skipped`));
}
for (const { relativePath, reason } of skippedLinks) {
  console.log(chalk.yellow(`  ! ${relativePath} — skipped, ${reason}`));
}
if (trackedSkipped.length > 0) {
  console.log(chalk.dim(`  ${trackedSkipped.length} git-tracked file(s) skipped: ${trackedSkipped.join(', ')}`));
}

if (files.length === 0) {
  console.log(chalk.yellow('\nNothing to sync.\n'));
  process.exit(0);
}

// ── Compare against every target ───────────────────────────────────────────
const columnWidth = Math.max(...files.map(({ length }) => length));
const pendingCopies = [];

console.log('');
for (const target of targets) {
  console.log(`${chalk.bold(target.name)} ${chalk.dim(`(${target.branch ?? 'unknown branch'})`)}`);
  for (const entry of planForTarget(source, target, files)) {
    const label = entry.relativePath.padEnd(columnWidth);
    if (entry.status === 'create') {
      console.log(chalk.green(`  + ${label}  create`));
      pendingCopies.push(entry);
    } else if (entry.status === 'overwrite') {
      console.log(chalk.yellow(`  ~ ${label}  overwrite ${chalk.dim(`(target modified ${entry.modified})`)}`));
      pendingCopies.push(entry);
    } else if (entry.status === 'skip') {
      console.log(chalk.yellow(`  ! ${label}  skipped — ${entry.reason}`));
    } else {
      console.log(chalk.dim(`  = ${label}  unchanged`));
    }

    if (options.diff && entry.status === 'overwrite') {
      const diff = await $`git --no-pager diff --no-index --color ${entry.sourceFile} ${entry.targetFile}`.nothrow();
      console.log(diff.stdout.trimEnd() + '\n');
    }
  }
}

if (pendingCopies.length === 0) {
  console.log(chalk.green('\nEvery worktree is already up to date.\n'));
  process.exit(0);
}

const worktreesTouched = new Set(pendingCopies.map(({ targetName }) => targetName)).size;
const summary = `${pendingCopies.length} file(s) into ${worktreesTouched} worktree(s)`;

if (options.dryRun) {
  console.log(chalk.cyan(`\nDry run — ${summary} would be copied.\n`));
  process.exit(0);
}

// ── Copy ───────────────────────────────────────────────────────────────────
if (!options.yes) {
  if (!process.stdin.isTTY) {
    die('Not running interactively — re-run with --yes to copy without confirmation.');
  }
  const confirmed = await confirm({ message: `Copy ${summary}?`, default: true });
  if (!confirmed) {
    console.log(chalk.dim('\nAborted.\n'));
    process.exit(0);
  }
}

for (const entry of pendingCopies) {
  copyFile(entry);
}

console.log(chalk.green(`\nCopied ${summary}.\n`));
