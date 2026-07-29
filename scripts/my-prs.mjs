#!/usr/bin/env node
/**
 * Summarize open pull requests authored by the current GitHub user.
 *
 * Answers the questions that normally require clicking into each PR:
 * how old it is, when it last moved, how many review conversations are
 * still unresolved, and whether it has a merge conflict.
 *
 * Usage:
 *   node scripts/my-prs.mjs [options]
 *
 *   --repo <owner/name>  Another repo (defaults to the repo in the cwd)
 *   --all                Every repo, not just the current one
 *   --details, -d        Also print each unresolved review thread
 *   --sort <field>       updated (default) | created | number | unresolved
 *   --json               Emit raw JSON instead of a table
 *   --help, -h
 */
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Page sizes are deliberately modest: GraphQL rate limit cost scales with the number of requested
// nodes, and search x reviewThreads multiplies out fast. Overflow is reported rather than hidden.
const SEARCH_QUERY = `
query($searchQuery: String!) {
  search(query: $searchQuery, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        headRefName
        isDraft
        createdAt
        updatedAt
        mergeable
        reviewDecision
        repository { nameWithOwner }
        reviewThreads(first: 50) {
          totalCount
          nodes {
            isResolved
            path
            line
            comments(first: 1) {
              totalCount
              nodes {
                author { login }
                body
              }
            }
          }
        }
      }
    }
  }
}`;

/** GitHub computes mergeability lazily, so a fresh PR reports UNKNOWN until the background job finishes. */
const MERGEABLE_RETRY_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { mergeable }
  }
}`;

const SORTERS = {
  updated: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  number: (a, b) => b.number - a.number,
  unresolved: (a, b) => b.unresolvedCount - a.unresolvedCount || new Date(b.updatedAt) - new Date(a.updatedAt),
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const style = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = style('2');
const bold = style('1');
const red = style('31');
const yellow = style('33');
const green = style('32');
const cyan = style('36');

function parseArgs(argv) {
  const options = { repo: undefined, all: false, details: false, wide: false, sort: 'updated', json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--details' || arg === '-d') {
      options.details = true;
    } else if (arg === '--wide' || arg === '-w') {
      options.wide = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--repo') {
      options.repo = argv[++i];
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length);
    } else if (arg === '--sort') {
      options.sort = argv[++i];
    } else if (arg.startsWith('--sort=')) {
      options.sort = arg.slice('--sort='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!SORTERS[options.sort]) {
    throw new Error(`Unknown sort "${options.sort}". Expected one of: ${Object.keys(SORTERS).join(', ')}`);
  }
  return options;
}

async function gh(args) {
  try {
    const { stdout } = await execFileAsync('gh', args, { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    // execFile puts the whole command (including the multi-line query) in the message; keep only gh's complaint.
    const [firstLine] = (error.stderr || error.message).trim().split('\n');
    throw new Error(firstLine || 'gh command failed');
  }
}

async function graphql(query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    // -f keeps strings literal (no @file or boolean coercion), -F preserves Int variables.
    args.push(typeof value === 'number' ? '-F' : '-f', `${key}=${value}`);
  }
  const { data, errors } = JSON.parse(await gh(args));
  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join('\n'));
  }
  return data;
}

/** Returns undefined outside a GitHub repo so the report silently widens to every repo. */
async function resolveCurrentRepo() {
  try {
    return JSON.parse(await gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
  } catch {
    return undefined;
  }
}

/** Used only to highlight the row you are standing on; undefined outside a git checkout. */
async function resolveCurrentBranch() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/** Maps branch name to the checkout that holds it, so those rows can link to the folder on disk. */
async function resolveWorktrees() {
  const worktrees = new Map();
  try {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain']);
    let worktreePath;
    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        worktreePath = line.slice('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        worktrees.set(line.slice('branch refs/heads/'.length), worktreePath);
      }
    }
  } catch {
    // Not a git checkout — every branch simply renders unlinked.
  }
  return worktrees;
}

function toRelativeTime(isoDate) {
  const seconds = Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 1000);
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];
  for (const [label, size] of units) {
    if (seconds >= size) {
      return `${Math.floor(seconds / size)}${label}`;
    }
  }
  return 'now';
}

function normalizePullRequest(node) {
  const threads = node.reviewThreads.nodes;
  const unresolved = threads.filter(({ isResolved }) => !isResolved);
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    branch: node.headRefName,
    repo: node.repository.nameWithOwner,
    isDraft: node.isDraft,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    mergeable: node.mergeable,
    reviewDecision: node.reviewDecision,
    unresolvedCount: unresolved.length,
    // reviewThreads is paged; flag the (rare) PR where the count is a floor, not a total.
    unresolvedTruncated: node.reviewThreads.totalCount > threads.length,
    unresolvedThreads: unresolved.map(({ path, line, comments }) => ({
      path,
      line,
      commentCount: comments.totalCount,
      author: comments.nodes[0]?.author?.login ?? 'unknown',
      body: comments.nodes[0]?.body ?? '',
    })),
  };
}

/** Re-request mergeability for PRs that reported UNKNOWN; the first request kicks off the computation. */
async function backfillMergeable(pullRequests) {
  const pending = pullRequests.filter(({ mergeable }) => mergeable === 'UNKNOWN');
  if (pending.length === 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await Promise.all(
    pending.map(async (pullRequest) => {
      const [owner, name] = pullRequest.repo.split('/');
      try {
        const data = await graphql(MERGEABLE_RETRY_QUERY, { owner, name, number: pullRequest.number });
        pullRequest.mergeable = data.repository.pullRequest.mergeable;
      } catch {
        // Leave it as UNKNOWN — it renders as "?" rather than failing the whole report.
      }
    }),
  );
}

function link(text, url) {
  return useColor ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text;
}

function truncate(text, width) {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

const MERGE_LABELS = {
  CONFLICTING: { text: 'CONFLICT', color: red },
  MERGEABLE: { text: 'ok', color: green },
  UNKNOWN: { text: '?', color: dim },
};

const REVIEW_LABELS = {
  APPROVED: { text: 'approved', color: green },
  CHANGES_REQUESTED: { text: 'changes', color: red },
  REVIEW_REQUIRED: { text: 'waiting', color: dim },
};

function renderTable(pullRequests, { details, wide, currentBranch }) {
  const showRepo = new Set(pullRequests.map(({ repo }) => repo)).size > 1;
  const repoWidth = Math.min(28, Math.max(4, ...pullRequests.map(({ repo }) => repo.length)));
  const columns = [
    { header: 'PR', width: Math.max(2, ...pullRequests.map(({ number }) => `#${number}`.length)) },
    ...(showRepo ? [{ header: 'REPO', width: repoWidth }] : []),
    { header: 'BRANCH', width: 0 },
    { header: 'TITLE', width: 0 },
    { header: 'OPENED', width: 6 },
    { header: 'UPDATED', width: 7 },
    { header: 'UNRES', width: 5 },
    { header: 'REVIEW', width: 8 },
    { header: 'MERGE', width: 8 },
  ];

  // BRANCH and TITLE share whatever the fixed columns leave over. Branch is shown in full whenever
  // it fits, since a truncated branch name cannot be copied and pasted into a git command; only a
  // terminal too narrow to leave TITLE_RESERVE for the title forces it to give ground.
  const TITLE_RESERVE = 30;
  const terminalWidth = wide ? Number.MAX_SAFE_INTEGER : (process.stdout.columns ?? 120);
  const fixedWidth = columns.reduce((total, { width }) => total + width, 0) + (columns.length - 1) * 2;
  const flexibleWidth = terminalWidth - fixedWidth - 1;
  const branchColumn = columns.find(({ header }) => header === 'BRANCH');
  const titleColumn = columns.find(({ header }) => header === 'TITLE');
  const longestBranch = Math.max(6, ...pullRequests.map(({ branch }) => branch.length));
  const longestTitle = Math.max(5, ...pullRequests.map(({ title, isDraft }) => title.length + (isDraft ? 8 : 0)));
  branchColumn.width = Math.min(longestBranch, Math.max(14, flexibleWidth - TITLE_RESERVE));
  titleColumn.width = Math.max(24, Math.min(wide ? longestTitle : 70, flexibleWidth - branchColumn.width));

  const pad = (text, width) => text + ' '.repeat(Math.max(0, width - text.length));
  const header = columns.map(({ header: text, width }) => pad(text, width)).join('  ');
  const lines = [dim(header)];

  for (const pullRequest of pullRequests) {
    const { number, title, url, branch, repo, worktreePath, isDraft, unresolvedCount, unresolvedTruncated } = pullRequest;
    const numberText = `#${number}`;
    const titleText = truncate(isDraft ? `[draft] ${title}` : title, titleColumn.width);
    const unresolvedText = `${unresolvedCount}${unresolvedTruncated ? '+' : ''}`;
    const merge = MERGE_LABELS[pullRequest.mergeable] ?? MERGE_LABELS.UNKNOWN;
    const review = REVIEW_LABELS[pullRequest.reviewDecision] ?? { text: '-', color: dim };

    // Green marks the checkout you are standing in; underline marks a branch you can click through to.
    // Padding stays outside the hyperlink so only the name itself is clickable, not the empty space after it.
    const branchText = truncate(branch, branchColumn.width);
    const styledBranch = style(`${branch === currentBranch ? '32' : '2'}${worktreePath ? ';4' : ''}`)(branchText);

    const cells = [
      cyan(link(numberText, url)) + ' '.repeat(Math.max(0, columns[0].width - numberText.length)),
      ...(showRepo ? [dim(pad(truncate(repo, repoWidth), repoWidth))] : []),
      (worktreePath ? link(styledBranch, pathToFileURL(worktreePath).href) : styledBranch) +
        ' '.repeat(Math.max(0, branchColumn.width - branchText.length)),
      isDraft ? dim(pad(titleText, titleColumn.width)) : pad(titleText, titleColumn.width),
      dim(pad(toRelativeTime(pullRequest.createdAt), 6)),
      dim(pad(toRelativeTime(pullRequest.updatedAt), 7)),
      (unresolvedCount > 0 ? yellow : dim)(pad(unresolvedText, 5)),
      review.color(pad(review.text, 8)),
      merge.color(pad(merge.text, 8)),
    ];
    lines.push(cells.join('  ').trimEnd());

    if (details && unresolvedCount > 0) {
      for (const thread of pullRequest.unresolvedThreads) {
        const location = thread.path ? `${thread.path}${thread.line ? `:${thread.line}` : ''}` : 'general';
        const firstLine = thread.body.split('\n').find((text) => text.trim()) ?? '';
        const replies = thread.commentCount > 1 ? ` (+${thread.commentCount - 1})` : '';
        lines.push(`      ${yellow('•')} ${bold(location)} ${dim(`@${thread.author}${replies}`)}`);
        lines.push(`        ${dim(truncate(firstLine.trim(), Math.max(40, terminalWidth - 10)))}`);
      }
    }
  }

  const conflicts = pullRequests.filter(({ mergeable }) => mergeable === 'CONFLICTING').length;
  const totalUnresolved = pullRequests.reduce((total, { unresolvedCount }) => total + unresolvedCount, 0);
  lines.push('');
  lines.push(
    dim(
      [
        `${pullRequests.length} open PR${pullRequests.length === 1 ? '' : 's'}`,
        `${totalUnresolved} unresolved thread${totalUnresolved === 1 ? '' : 's'}`,
        `${conflicts} with conflicts`,
      ].join('  ·  '),
    ),
  );
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      [
        'Usage: node scripts/my-prs.mjs [options]',
        '',
        '  --repo <owner/name>  Another repo (defaults to the repo in the cwd)',
        '  --all                Every repo, not just the current one',
        '  --details, -d        Also print each unresolved review thread',
        '  --wide, -w           Never truncate; ignore the terminal width',
        '  --sort <field>       updated (default) | created | number | unresolved',
        '  --json               Emit raw JSON instead of a table',
        '  --help, -h           Show this help',
        '',
        'PR numbers link to GitHub. Underlined branches have a local worktree and link to it',
        'on disk; the branch you are currently in is green.',
      ].join('\n'),
    );
    return;
  }

  const currentRepo = await resolveCurrentRepo();
  const repo = options.all ? undefined : (options.repo ?? currentRepo);
  const searchQuery = ['is:open', 'is:pr', 'author:@me', 'archived:false', repo && `repo:${repo}`].filter(Boolean).join(' ');

  const data = await graphql(SEARCH_QUERY, { searchQuery });
  const pullRequests = data.search.nodes.filter((node) => node?.number).map(normalizePullRequest);

  if (pullRequests.length === 0) {
    console.log(dim('No open pull requests.'));
    return;
  }

  await backfillMergeable(pullRequests);
  pullRequests.sort(SORTERS[options.sort]);

  const [currentBranch, worktrees] = await Promise.all([resolveCurrentBranch(), resolveWorktrees()]);
  for (const pullRequest of pullRequests) {
    // Worktrees only describe the repo we are standing in, so rows from elsewhere stay unlinked.
    pullRequest.worktreePath = (pullRequest.repo === currentRepo && worktrees.get(pullRequest.branch)) || null;
  }

  console.log(options.json ? JSON.stringify(pullRequests, null, 2) : renderTable(pullRequests, { ...options, currentBranch }));
}

main().catch((error) => {
  console.error(`my-prs: ${error.message}`);
  process.exitCode = 1;
});
