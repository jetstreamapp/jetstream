#!/usr/bin/env node

/**
 * Print a factual "what changed since the last release" digest used to draft a
 * release note. This script does NOT call any AI — it only gathers data:
 * merged PRs since the last `v*` tag (title, body, labels, touched areas) plus
 * any direct commits.
 *
 * The Claude Code `/release-notes` slash command runs this and turns the digest
 * into an end-user release note. You can also run it standalone and paste the
 * output into any AI assistant alongside the drafting guidelines in
 * `.claude/commands/release-notes.md`.
 *
 * Usage:
 *   node scripts/release-notes-context.mjs [--version X.Y.Z | --bump patch|minor|major]
 *                                          [--base <tag>] [--date YYYY-MM-DD] [--json]
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { $ } from 'zx';
import { fetchTags, getLatestWebTag, getMergedPrsSince, refExists, REPO_SLUG } from './lib/gather-prs.mjs';

$.verbose = false;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const baseTag = options.base ?? (await getLatestWebTag());
if (!baseTag) {
  fail('No v* release tags found in this repo. Pass --base <tag>.');
}
if (!(await refExists(baseTag))) {
  fail(`Base tag "${baseTag}" not found.`);
}

const currentVersion = await readCurrentVersion();
const targetVersion = options.version ?? bumpVersion(currentVersion, options.bump ?? 'patch');
const targetDate = options.date ?? today();

// `--head` lets the backfill flow gather PRs between two historical tags
// (e.g. --base v9.14.0 --head v9.15.0). Defaults to the working tree (HEAD).
if (options.head && !(await refExists(options.head))) {
  fail(`Head ref "${options.head}" not found.`);
}
const { headSha, currentBranch, prs, directCommits, totalCommits } = await getMergedPrsSince(baseTag, {
  head: options.head ?? 'HEAD',
});

// For backfill runs (`--head <tag>`) the head is the requested ref, not the working branch.
const headLabel = options.head && options.head !== 'HEAD' ? options.head : currentBranch;

const enrichedPrs = [];
for (const pr of prs) {
  enrichedPrs.push(await enrichPr(pr));
}

if (options.json) {
  printJson({ targetVersion, targetDate, baseTag, headSha, currentBranch, headLabel, totalCommits, prs: enrichedPrs, directCommits });
} else {
  printMarkdown({ targetVersion, targetDate, baseTag, headSha, currentBranch, headLabel, totalCommits, prs: enrichedPrs, directCommits });
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
  lines.push(`- target version: **${ctx.targetVersion}**`);
  lines.push(`- planned date: **${ctx.targetDate}**`);
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
  const result = { version: null, bump: null, base: null, head: null, date: null, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' || arg === '-v') {
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

Options:
  --version, -v <X.Y.Z>   Target version (default: current package.json version bumped by --bump)
  --bump <patch|minor|major>   Bump level used when --version is omitted (default: patch)
  --base, -b <tag>        Base release tag to compare against (default: latest v* tag)
  --head <ref>            Head ref to compare up to (default: HEAD; use a tag for backfill)
  --date <YYYY-MM-DD>     Planned release date (default: today)
  --json                  Emit JSON instead of the Markdown digest
  --help, -h              Show this help
`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (result.version && result.bump) {
    fail('Pass either --version or --bump, not both.');
  }
  return result;
}
