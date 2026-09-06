#!/usr/bin/env node

/**
 * Copy local, gitignored files (.env, code-signing assets, …) from one worktree to the others.
 *
 * Git never syncs these files because they are not tracked, so every new worktree starts without
 * them and any edit to one worktree's copy leaves the rest stale. This script pushes the files
 * from the worktree you are standing in to the other registered worktrees, showing exactly what
 * would be created or overwritten before it touches anything.
 *
 * Files tracked in either worktree are skipped by default (use --include-tracked to override).
 * Symlinks, including parent directories, and special files are skipped on both sides.
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

/** Never copied, even when explicitly requested. */
const ALWAYS_IGNORED = new Set(['.git', 'node_modules', '.DS_Store']);

function die(message) {
  console.error(chalk.red(`\n${message}\n`));
  process.exit(1);
}

function printHelp() {
  console.log(`Copy local, gitignored files from one worktree to the others.

Usage: pnpm worktree:sync [paths...] [options]

Paths are relative to the worktree root. Defaults to: ${DEFAULT_PATHS.join(', ')}
Directories are copied recursively, skipping files tracked in either worktree by default.
Symlinks (including parent directories) and special files are skipped.

Options:
  --to <name|path>    Sync only to this worktree (repeatable; default: all other worktrees)
  --from <name|path>  Worktree to copy from (default: the one you are in)
  --dry-run           Report what would change without copying anything
  --diff              Show a diff for every file that would be overwritten
  --include-tracked   Allow copying files tracked in either worktree
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
  if (byName.length > 1) {
    const candidates = byName.map(({ path }) => `  ${path}`).join('\n');
    die(`"${identifier}" is the name of more than one worktree — pass the full path instead:\n${candidates}`);
  }
  const known = worktrees.map(({ name, path }) => `  ${name}  ${chalk.dim(path)}`).join('\n');
  die(`No worktree matches "${identifier}". Known worktrees:\n${known}`);
}

/** Inspect each component beneath the worktree root before reading or writing through it. */
function inspectPath(rootDir, relativePath) {
  const parts = relativePath.split(sep).filter(Boolean);
  if (parts.some((part) => ALWAYS_IGNORED.has(part))) {
    return { reason: 'excluded path' };
  }
  let path = rootDir;
  let stats = lstatSafe(path);
  for (let i = 0; i < parts.length; i++) {
    path = join(path, parts[i]);
    stats = lstatSafe(path);
    if (!stats) return { stats: null };
    if (stats.isSymbolicLink()) return { reason: `symlink at ${parts.slice(0, i + 1).join(sep)} -> ${readlinkSync(path)}` };
    if (!stats.isFile() && !stats.isDirectory()) return { reason: 'not a regular file or directory' };
    if (i < parts.length - 1 && !stats.isDirectory()) return { reason: 'parent path is not a directory' };
  }
  return { stats };
}

/** Collect regular files, skipping symlinks and excluded directories. */
function walkFiles(rootDir, relativePath, collected, skipped) {
  const { stats, reason } = inspectPath(rootDir, relativePath);
  if (reason || !stats) {
    skipped.push({ relativePath, reason: reason ?? 'does not exist' });
    return;
  }
  if (stats.isFile()) {
    collected.push(relativePath);
    return;
  }

  for (const entry of readdirSync(join(rootDir, relativePath), { withFileTypes: true })) {
    if (ALWAYS_IGNORED.has(entry.name)) {
      continue;
    }
    walkFiles(rootDir, join(relativePath, entry.name), collected, skipped);
  }
}

/**
 * Match index entries the way the checkout does. On a case-insensitive volume `Foo` and `foo` are the
 * same file, so an exact comparison would miss a tracked entry and let the copy clobber it. Git probes
 * the real filesystem when the repo is created, which beats guessing from `process.platform`.
 */
async function caseFolder(rootDir) {
  const { stdout } = await $`git -C ${rootDir} config --get core.ignorecase`.nothrow();
  return stdout.trim() === 'true' ? (path) => path.toLowerCase() : (path) => path;
}

/** Reads the whole index: no pathspec interpretation, and one path format on each platform. */
async function trackedFileLookup(rootDir) {
  const output = (await $`git -C ${rootDir} ls-files -z`).stdout;
  const fold = await caseFolder(rootDir);
  const tracked = new Set(
    output
      .split('\0')
      .filter(Boolean)
      .map((path) => fold(path.split('/').join(sep))),
  );
  return (relativePath) => tracked.has(fold(relativePath));
}

const NOTHING_TRACKED = () => false;

/** Expand the requested paths into a concrete file list, minus anything git already tracks. */
async function collectFiles(sourceWorktree, requestedPaths, includeTracked) {
  const rootDir = sourceWorktree.path;
  const files = [];
  const skipped = [];

  for (const requestedPath of requestedPaths) {
    const absolutePath = resolve(rootDir, requestedPath);
    if (absolutePath !== rootDir && !absolutePath.startsWith(rootDir + sep)) {
      die(`"${requestedPath}" resolves outside of ${rootDir}`);
    }
    const relativePath = absolutePath.slice(rootDir.length + 1);
    walkFiles(rootDir, relativePath, files, skipped);
  }

  const uniqueFiles = [...new Set(files)];
  const isTracked = includeTracked || files.length === 0 ? NOTHING_TRACKED : await trackedFileLookup(rootDir);
  return {
    files: uniqueFiles.filter((relativePath) => !isTracked(relativePath)),
    skipped,
    trackedSkipped: uniqueFiles.filter((relativePath) => isTracked(relativePath)),
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

async function planForTarget(sourceWorktree, targetWorktree, files, includeTracked) {
  const isTracked = includeTracked ? NOTHING_TRACKED : await trackedFileLookup(targetWorktree.path);
  return files.map((relativePath) => {
    const sourceFile = join(sourceWorktree.path, relativePath);
    const targetFile = join(targetWorktree.path, relativePath);
    const entry = { relativePath, sourceFile, targetFile, targetKey: targetWorktree.key };
    if (isTracked(relativePath)) {
      return { ...entry, status: 'skip', reason: 'git-tracked in target' };
    }
    const { stats: targetStats, reason } = inspectPath(targetWorktree.path, relativePath);
    if (reason) {
      return { ...entry, status: 'skip', reason };
    }
    if (!targetStats) {
      return { ...entry, status: 'create' };
    }
    if (targetStats.isDirectory()) {
      return { ...entry, status: 'skip', reason: 'a directory exists at this path' };
    }
    const sameMode = process.platform === 'win32' || (statSync(sourceFile).mode & 0o777) === (targetStats.mode & 0o777);
    if (sameMode && sourceHash(sourceFile) === hashFile(targetFile)) {
      return { ...entry, status: 'unchanged' };
    }
    return { ...entry, status: 'overwrite', modified: targetStats.mtime.toISOString().slice(0, 16).replace('T', ' ') };
  });
}

function lstatSafe(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function copyFile({ sourceFile, targetFile }) {
  mkdirSync(dirname(targetFile), { recursive: true });
  // Signing assets are often kept read-only, and copyFileSync cannot open such a target for writing.
  if (lstatSafe(targetFile)) {
    chmodSync(targetFile, 0o600);
  }
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
const { files, skipped, trackedSkipped } = await collectFiles(source, options.paths, options.includeTracked);

console.log('\n' + chalk.bold.cyan('  Worktree file sync') + '\n');
console.log(`${chalk.bold('Source:')} ${source.name} ${chalk.dim(`(${source.branch ?? 'unknown branch'})`)}`);
console.log(`${chalk.bold('Files: ')} ${files.length > 0 ? files.join(', ') : chalk.dim('none')}`);
for (const { relativePath, reason } of skipped) {
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
  for (const entry of await planForTarget(source, target, files, options.includeTracked)) {
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
  console.log(chalk.green('\nNothing to copy (files are unchanged or skipped).\n'));
  process.exit(0);
}

const worktreesTouched = new Set(pendingCopies.map(({ targetKey }) => targetKey)).size;
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
