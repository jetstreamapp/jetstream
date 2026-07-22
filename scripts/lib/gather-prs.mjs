/**
 * Shared git history helpers for the release tooling.
 *
 * Walks the main-line history between a base release tag and a head ref and
 * splits it into merged PRs and direct commits. Used by both
 * `scripts/release-preview.mjs` (human-facing preview) and
 * `scripts/release-notes-context.mjs` (release-note drafting context).
 */
import { $ } from 'zx';

export const REPO_SLUG = 'jetstreamapp/jetstream';
export const REMOTE = 'origin';
export const MERGE_PR_REGEX = /^Merge pull request #(\d+) from (\S+)/;

/** Best-effort `git fetch --tags`. Returns true on success, false if offline. */
export async function fetchTags(remote = REMOTE) {
  try {
    await $`git fetch ${remote} --tags --prune --quiet`;
    return true;
  } catch {
    return false;
  }
}

/** All web (`v*`) release tags, newest first. */
export async function listWebTags() {
  const raw = (await $`git tag --list 'v[0-9]*' --sort=-v:refname`).stdout.trim();
  return raw ? raw.split('\n').filter(Boolean) : [];
}

/** Most recent web (`v*`) release tag, or null if none exist. */
export async function getLatestWebTag() {
  const [latest] = await listWebTags();
  return latest ?? null;
}

/** True if a tag/ref resolves. */
export async function refExists(ref) {
  try {
    await $`git rev-parse --verify ${ref}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * The real change description for a merged PR. The merge commit's own subject
 * is just "Merge pull request #X from ..." which isn't useful — the actual
 * description lives in the merge commit body, falling back to the branch name.
 */
export async function resolvePrLabel(mergeSha, sourceRef) {
  try {
    const body = (await $`git log -1 --format=%b ${mergeSha}`).stdout.trim();
    const firstLine = body.split('\n').find((line) => line.trim());
    if (firstLine) {
      return firstLine.trim();
    }
  } catch {
    // fall through to the branch-name fallback
  }
  return sourceRef.replace(/^[^/]+\//, '');
}

/**
 * Gather the main-line history between `baseTag` and `head`, split into merged
 * PRs and direct commits.
 *
 * `--first-parent` walks only the main-line history, so we see each merge
 * commit once and any commits pushed directly (without a PR). Without it, every
 * commit inside every merged PR branch would also show up.
 *
 * @returns {{ baseTag: string, baseSha: string, headSha: string, currentBranch: string,
 *   range: string, prs: Array<{sha,short,subject,number,label}>,
 *   directCommits: Array<{sha,short,subject}>, mainlineCommits: Array<{sha,short,subject}>,
 *   totalCommits: number }}
 */
export async function getMergedPrsSince(baseTag, { path = null, head = 'HEAD' } = {}) {
  const baseSha = (await $`git rev-parse ${baseTag}`).stdout.trim();
  const headSha = (await $`git rev-parse ${head}`).stdout.trim();
  const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim();
  const range = `${baseTag}..${head}`;
  const pathArgs = path ? ['--', path] : [];

  const logOutput = (await $`git log --first-parent --format=%H%x09%s ${range} ${pathArgs}`).stdout.trim();
  const mainlineCommits = logOutput
    ? logOutput.split('\n').map((line) => {
        const tabIndex = line.indexOf('\t');
        return { sha: line.slice(0, tabIndex), short: line.slice(0, 9), subject: line.slice(tabIndex + 1) };
      })
    : [];

  const prs = [];
  const directCommits = [];
  for (const commit of mainlineCommits) {
    const match = commit.subject.match(MERGE_PR_REGEX);
    if (match) {
      prs.push({ ...commit, number: match[1], label: await resolvePrLabel(commit.sha, match[2]) });
    } else {
      directCommits.push(commit);
    }
  }

  const totalCommitsOutput = (await $`git log --format=%H ${range} ${pathArgs}`).stdout.trim();
  const totalCommits = totalCommitsOutput ? totalCommitsOutput.split('\n').length : 0;

  return { baseTag, baseSha, headSha, currentBranch, range, prs, directCommits, mainlineCommits, totalCommits };
}
