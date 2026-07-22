#!/usr/bin/env node

/**
 * Print a factual "what changed in this release" digest used to draft a
 * release note. This script does NOT call any AI — it only gathers data:
 * merged PRs in the release's commit range (title, body, labels, touched areas)
 * plus any direct commits.
 *
 * Two modes:
 *   existing — notes for an already-cut release tag (the common flow: release
 *              first, notes after). The tag supplies the version, the release
 *              date, and the commit range (previous v* tag → the tag).
 *   upcoming — notes for a not-yet-tagged release. The version comes from
 *              package.json + a bump level, the range is latest v* tag → HEAD.
 *
 * With no targeting args the mode is auto-detected: if the current package.json
 * version is already tagged but has no release note yet, that release is
 * targeted; otherwise an upcoming patch release is assumed.
 *
 * The Claude Code `/release-notes` slash command runs this and turns the digest
 * into an end-user release note. You can also run it standalone and paste the
 * output into any AI assistant alongside the drafting guidelines in
 * `.claude/commands/release-notes.md`.
 *
 * Usage:
 *   node scripts/release-notes-context.mjs [--tag vX.Y.Z|latest | --version X.Y.Z | --bump patch|minor|major]
 *                                          [--base <tag>] [--date YYYY-MM-DD] [--json]
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { $ } from 'zx';
import { fetchTags, getLatestWebTag, getMergedPrsSince, listWebTags, refExists, REPO_SLUG } from './lib/gather-prs.mjs';

$.verbose = false;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_NOTES_DIR = path.join(ROOT, 'apps/docs/release-notes');
const BODY_TRUNCATE = 1200;

// Map a changed-file path to a coarse platform/area signal so the drafter can
// infer the release-note `tags` / `versions` without reading raw file lists.
const AREA_RULES = [
  { match: /^apps\/jetstream-web-extension\//, area: 'extension' },
  { match: /^apps\/jetstream-desktop(-client)?\//, area: 'desktop' },
  { match: /^apps\/jetstream\//, area: 'web' },
  { match: /^apps\/api\//, area: 'web (server)' },
  { match: /^apps\/landing\//, area: 'landing site' },
  { match: /^apps\/docs\//, area: 'docs' },
  { match: /^libs\//, area: 'shared lib' },
];

const options = parseArgs(process.argv.slice(2));

await fetchTags();

const currentVersion = await readCurrentVersion();

// Resolve which release the notes are for. `releaseTag` being set means "existing" mode.
let releaseTag = null;
if (options.tag) {
  releaseTag = options.tag === 'latest' ? await getLatestWebTag() : options.tag;
  if (!releaseTag) {
    fail('No v* release tags found in this repo.');
  }
  if (!(await refExists(releaseTag))) {
    fail(`Release tag "${releaseTag}" not found.`);
  }
} else if (!options.version && !options.bump && !options.head) {
  // No targeting args: if the current package.json version was already tagged but has no
  // release note yet, the release was cut first (the common flow) — target that tag.
  // Otherwise assume the pre-release flow and draft for the next patch version.
  const candidateTag = `v${currentVersion}`;
  if ((await refExists(candidateTag)) && !(await findReleaseNoteFor(currentVersion))) {
    releaseTag = candidateTag;
  }
}
const mode = releaseTag ? 'existing' : 'upcoming';

const targetVersion = releaseTag ? releaseTag.replace(/^v/, '') : (options.version ?? bumpVersion(currentVersion, options.bump ?? 'patch'));
const targetDate = options.date ?? (releaseTag ? await tagDate(releaseTag) : today());

// Existing mode compares the release tag against the tag right before it; upcoming mode
// compares the latest tag against the working tree.
const baseTag = options.base ?? (releaseTag ? await previousWebTag(releaseTag) : await getLatestWebTag());
if (!baseTag) {
  fail(
    releaseTag
      ? `No web release tag found before ${releaseTag}. Pass --base <tag>.`
      : 'No v* release tags found in this repo. Pass --base <tag>.',
  );
}
if (!(await refExists(baseTag))) {
  fail(`Base tag "${baseTag}" not found.`);
}

// `--head` lets a manual backfill gather PRs between two arbitrary refs; `--tag` sets it
// to the release tag automatically. Defaults to the working tree (HEAD).
const head = releaseTag ?? options.head ?? 'HEAD';
if (!(await refExists(head))) {
  fail(`Head ref "${head}" not found.`);
}

// Surface an already-written note so the drafter updates it instead of duplicating it.
const existingNoteFile = await findReleaseNoteFor(targetVersion);

const { headSha, currentBranch, prs, directCommits, totalCommits } = await getMergedPrsSince(baseTag, { head });

// When head is a tag/ref (not the working tree), label the range with it instead of the branch.
const headLabel = head !== 'HEAD' ? head : currentBranch;

const enrichedPrs = [];
for (const pr of prs) {
  enrichedPrs.push(await enrichPr(pr));
}

const context = {
  mode,
  releaseTag,
  existingNoteFile,
  targetVersion,
  targetDate,
  baseTag,
  headSha,
  currentBranch,
  headLabel,
  totalCommits,
  prs: enrichedPrs,
  directCommits,
};

if (options.json) {
  printJson(context);
} else {
  printMarkdown(context);
}

// ── Enrichment ──────────────────────────────────────────────────────────────

async function enrichPr(pr) {
  try {
    const raw = (await $`gh pr view ${pr.number} --repo ${REPO_SLUG} --json title,body,labels,files`).stdout.trim();
    const data = JSON.parse(raw);
    return {
      number: pr.number,
      title: data.title || pr.label,
      labels: (data.labels ?? []).map(({ name }) => name),
      body: truncate((data.body ?? '').trim(), BODY_TRUNCATE),
      areas: rollupAreas((data.files ?? []).map(({ path: filePath }) => filePath)),
    };
  } catch {
    // gh unavailable / not authed / PR not found — fall back to merge-commit data
    return { number: pr.number, title: pr.label, labels: [], body: '', areas: [], ghUnavailable: true };
  }
}

function rollupAreas(filePaths) {
  const counts = new Map();
  for (const filePath of filePaths) {
    const rule = AREA_RULES.find(({ match }) => match.test(filePath));
    const area = rule ? rule.area : 'other';
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([area, count]) => `${area} (${count})`);
}

// ── Output ───────────────────────────────────────────────────────────────────

function printMarkdown(ctx) {
  const lines = [];
  lines.push(`# Release-note context for v${ctx.targetVersion}`);
  lines.push('');
  if (ctx.mode === 'existing') {
    lines.push(`- mode: **existing release** — notes for the already-cut tag \`${ctx.releaseTag}\``);
    lines.push(`- target version: **${ctx.targetVersion}**`);
    lines.push(`- release date (from tag): **${ctx.targetDate}**`);
  } else {
    lines.push(`- mode: **upcoming release** — not yet tagged`);
    lines.push(`- target version: **${ctx.targetVersion}**`);
    lines.push(`- planned date: **${ctx.targetDate}**`);
  }
  if (ctx.existingNoteFile) {
    lines.push(
      `- ⚠ a release note for v${ctx.targetVersion} already exists: \`apps/docs/release-notes/${ctx.existingNoteFile}\` — update that file instead of creating a new one`,
    );
  }
  lines.push(`- base tag: **${ctx.baseTag}** → head: **${ctx.headLabel}** (${ctx.headSha.slice(0, 9)})`);
  lines.push(`- total commits in range: ${ctx.totalCommits}`);
  lines.push(`- compare: https://github.com/${REPO_SLUG}/compare/${ctx.baseTag}...${ctx.headSha}`);
  lines.push('');

  if (ctx.prs.length === 0) {
    lines.push('_No merged PRs found in this range._');
  } else {
    lines.push(`## Merged PRs (${ctx.prs.length})`);
    lines.push('');
    for (const pr of ctx.prs) {
      lines.push(`### #${pr.number} — ${pr.title}`);
      const meta = [];
      if (pr.labels.length) {
        meta.push(`labels: ${pr.labels.join(', ')}`);
      }
      if (pr.areas.length) {
        meta.push(`touched: ${pr.areas.join(', ')}`);
      }
      if (pr.ghUnavailable) {
        meta.push('_(gh details unavailable — merge-commit subject only)_');
      }
      if (meta.length) {
        lines.push(meta.join(' · '));
      }
      if (pr.body) {
        lines.push('');
        lines.push(pr.body);
      }
      lines.push('');
    }
  }

  if (ctx.directCommits.length > 0) {
    lines.push(`## Direct commits (no PR) (${ctx.directCommits.length})`);
    lines.push('');
    for (const commit of ctx.directCommits) {
      lines.push(`- ${commit.short} ${commit.subject}`);
    }
    lines.push('');
  }

  process.stdout.write(lines.join('\n') + '\n');
}

function printJson(ctx) {
  process.stdout.write(JSON.stringify(ctx, null, 2) + '\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readCurrentVersion() {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

/** The web (`v*`) release tag immediately preceding the given tag, or null. */
async function previousWebTag(tag) {
  const tags = await listWebTags();
  const index = tags.indexOf(tag);
  if (index === -1) {
    return null;
  }
  return tags[index + 1] ?? null;
}

/** ISO date (YYYY-MM-DD) of the commit a release tag points at. */
async function tagDate(tag) {
  return (await $`git log -1 --format=%cs ${tag}`).stdout.trim();
}

/** Release-note MDX filename for a version (e.g. `2026-06-22-v10.4.0.mdx`), or null if none exists. */
async function findReleaseNoteFor(version) {
  try {
    const files = await readdir(RELEASE_NOTES_DIR);
    return files.find((file) => file.endsWith(`-v${version}.mdx`)) ?? null;
  } catch {
    return null;
  }
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version
    .replace(/^v/, '')
    .split('.')
    .map((segment) => parseInt(segment, 10) || 0);
  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function truncate(text, max) {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max).trimEnd() + ' …[truncated]';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function parseArgs(args) {
  const result = { tag: null, version: null, bump: null, base: null, head: null, date: null, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tag' || arg === '-t') {
      const value = args[++i];
      // Accept `latest`, `v10.6.0`, or bare `10.6.0` (normalized to the tag name).
      result.tag = value === 'latest' ? 'latest' : value.replace(/^v?(\d)/, 'v$1');
    } else if (arg === '--version' || arg === '-v') {
      result.version = args[++i].replace(/^v/, '');
    } else if (arg === '--bump') {
      result.bump = args[++i];
    } else if (arg === '--base' || arg === '-b') {
      result.base = args[++i];
    } else if (arg === '--head') {
      result.head = args[++i];
    } else if (arg === '--date') {
      result.date = args[++i];
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/release-notes-context.mjs [options]

Modes (default: auto-detect — existing release if the current package.json version is
tagged but has no note yet, otherwise an upcoming patch release):
  --tag, -t <vX.Y.Z|latest>    Notes for an existing, already-cut release tag. The tag
                               supplies the version, date, and commit range.
  --version, -v <X.Y.Z>        Notes for an upcoming release with an explicit version
  --bump <patch|minor|major>   Notes for an upcoming release, bumped from package.json (default: patch)

Options:
  --base, -b <tag>        Base release tag to compare against (default: tag before --tag,
                          or the latest v* tag for upcoming releases)
  --head <ref>            Head ref to compare up to (default: the --tag ref, or HEAD)
  --date <YYYY-MM-DD>     Release date (default: the tag's commit date, or today)
  --json                  Emit JSON instead of the Markdown digest
  --help, -h              Show this help
`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (result.tag && (result.version || result.bump || result.head)) {
    fail('--tag cannot be combined with --version, --bump, or --head.');
  }
  if (result.version && result.bump) {
    fail('Pass either --version or --bump, not both.');
  }
  if (result.bump && !['patch', 'minor', 'major'].includes(result.bump)) {
    fail(`Invalid --bump value: ${result.bump}. Use patch, minor, or major.`);
  }
  return result;
}
