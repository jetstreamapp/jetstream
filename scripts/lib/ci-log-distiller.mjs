/**
 * Turns a raw GitHub Actions job log into the ~1% of it that explains the failure.
 *
 * A single CI job log here is 200-400KB of runner boilerplate, pnpm install chatter, Nx task
 * output and postgres service noise. The failure is usually 20-60 lines somewhere in the middle.
 * `distillJobLog` finds the step that failed, keeps the regions around high-signal lines plus the
 * tail of that step, and drops everything else.
 *
 * Nothing here is Playwright-specific — the same treatment works for typecheck, vitest, lint and
 * build failures, which is the point.
 */

const BOM_AND_TIMESTAMP = /^\uFEFF?\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;
// Matching a control character is the entire point here: CI output is full of color codes.
// oxlint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\u001B\[[0-9;]*[A-Za-z]/g;
const GROUP_PREFIX = '##[group]Run ';

/** Remove terminal color codes so error text can be read, matched and diffed as plain text. */
export function stripAnsi(value) {
  return (value || '').replace(ANSI_ESCAPE, '');
}

/**
 * Lines that never explain anything but show up next to real errors often enough to crowd them
 * out of the excerpt. They stay in the full log, they just do not count as signal or context.
 */
const NOISE_PATTERNS = [
  /^##\[debug\]/,
  /^Download action repository/,
  /Mail client not configured/,
  /FATAL: {2}role "root" does not exist/,
  /DeprecationWarning:/,
  /^\(Use `node --trace-deprecation/,
  /^ *(Progress|Received) \d+ of \d+/,
  /^npm warn|WARN deprecated/,
  /^Post job cleanup/,
  // Playwright prints where it wrote each attachment on the runner. Those paths are gone with the
  // runner; the bundle carries the attachments themselves.
  /^ *attachment #\d+: /,
  /^ *[─-]{20,}$/,
  /^ *Error Context: /,
  /^ *Usage:$/,
  /playwright show-trace /,
  /^ *dist\/\.playwright\//,
];

/** Lines that open a block of runner-injected key/value noise, closed by `##[endgroup]`. */
const SUPPRESSED_BLOCK_START = /^ *(env|with):$/;

/**
 * When a step fails the job stops, so everything the runner prints afterwards — post-action
 * cleanup, service container teardown, the postgres image's startup banner — lands inside that
 * step's slice of the log. These markers are where the step's own output actually ends.
 */
const POST_STEP_MARKERS = [
  /^Post job cleanup/,
  /^Stop and remove container:/,
  /^Print service container logs:/,
  /^Cleaning up orphan processes/,
  /^Pruning is unnecessary\./,
  /^Temporarily overriding HOME=/,
];

/**
 * Each entry keeps `before` lines above and `after` lines below a match. The windows differ a lot
 * by tool: a Playwright failure block runs ~45 lines (call log, code frame, attachments), while a
 * `tsc` diagnostic is done in three.
 */
const SIGNAL_PATTERNS = [
  // Nx replays a failed task's whole output inside a collapsed group at the end of the run. For any
  // Nx target — build, test, typecheck — this is where the actual error text lives.
  { pattern: /^##\[group\]❌/, before: 0, after: 60 },
  { pattern: /^##\[error\]/, before: 10, after: 4 },
  { pattern: /^ *Type error: /, before: 6, after: 8 },
  { pattern: /^ *(Failed to compile|Build failed|Compilation failed|Build error occurred)/, before: 2, after: 20 },
  { pattern: /^ {0,4}\d+\) .+ › /, before: 1, after: 45 },
  { pattern: /\berror TS\d+\b/, before: 1, after: 4 },
  { pattern: /^ *(FAIL|✗|×|✘|❯) /, before: 0, after: 14 },
  { pattern: /(AssertionError|TimeoutError|ReferenceError|SyntaxError|TypeError|Unhandled error)\b/, before: 3, after: 14 },
  { pattern: /^ *Failed tasks:/, before: 3, after: 14 },
  { pattern: /^ *(Test Files|Tests) +\d+ failed/, before: 8, after: 3 },
  { pattern: /^ {0,4}\d+ (failed|flaky)$/, before: 3, after: 4 },
  { pattern: /^ *(Error|error): /, before: 2, after: 10 },
  { pattern: /Found \d+ (error|warning)/, before: 24, after: 2 },
  { pattern: /^ *(✖|error) .*(oxlint|oxfmt)/, before: 2, after: 10 },
  { pattern: /Cannot find (module|name)|is not assignable to|has no exported member/, before: 2, after: 6 },
];

/** Command substrings that identify what tool ran, used for framework detection and repro hints. */
const FRAMEWORK_RULES = [
  { framework: 'playwright', match: /playwright test|start-server-and-test/ },
  { framework: 'vitest', match: /--target=test\b|\bvitest\b|pnpm test:?\b/ },
  { framework: 'typescript', match: /typecheck|tsc\b|sync:check/ },
  { framework: 'lint', match: /\blint\b|oxlint/ },
  { framework: 'format', match: /format:check|oxfmt/ },
  { framework: 'build', match: /\bbuild\b/ },
  { framework: 'database', match: /db:migrate|db:seed|db:generate|prisma/ },
];

/** Strip the runner timestamp and ANSI codes from every line of a raw job log. */
export function cleanLog(rawLog) {
  return rawLog.split(/\r?\n/).map((line) => line.replace(BOM_AND_TIMESTAMP, '').replace(ANSI_ESCAPE, '').replace(/\r/g, '').trimEnd());
}

/**
 * Split cleaned lines into the steps the workflow ran. GitHub opens every step with
 * `##[group]Run <command>`, so the command — not the step's display name — is what identifies it.
 */
export function splitSteps(lines) {
  const steps = [];
  let current = { command: 'Set up job', startLine: 0, lines: [] };

  lines.forEach((line, index) => {
    if (line.startsWith(GROUP_PREFIX)) {
      steps.push(current);
      current = { command: line.slice(GROUP_PREFIX.length).trim(), startLine: index, lines: [] };
    }
    current.lines.push(line);
  });
  steps.push(current);

  return steps;
}

function isNoise(line) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Indices of the `env:` / `with:` dumps the runner prints when it opens a step. They are long,
 * identical in every job, and full of masked secret names that read like content but are not.
 */
function suppressedBlockIndices(lines) {
  const suppressed = new Set();
  let inBlock = false;

  lines.forEach((line, index) => {
    if (SUPPRESSED_BLOCK_START.test(line)) {
      inBlock = true;
    } else if (line.startsWith('##[endgroup]')) {
      inBlock = false;
    }
    if (inBlock) {
      suppressed.add(index);
    }
  });

  return suppressed;
}

/** Drop the runner's post-job output that trails a failing step (see POST_STEP_MARKERS). */
function trimPostStepOutput(lines) {
  const lastError = lines.findLastIndex((line) => line.startsWith('##[error]'));
  const searchFrom = lastError >= 0 ? lastError + 1 : 0;
  const cutoff = lines.findIndex((line, index) => index >= searchFrom && POST_STEP_MARKERS.some((marker) => marker.test(line)));
  return cutoff > 0 ? lines.slice(0, cutoff) : lines;
}

function detectFramework(command, lines) {
  // A step that runs a marketplace action (`owner/repo@ref`) failed in the runner setup, not in
  // this repo's tooling — decide that from the command before any keyword can match its output.
  if (/^[\w.-]+\/[\w.-]+@\S+$/.test(command.trim())) {
    return 'infra';
  }
  const haystack = `${command}\n${lines.slice(0, 400).join('\n')}`;
  return FRAMEWORK_RULES.find(({ match }) => match.test(haystack))?.framework ?? 'unknown';
}

/**
 * Nx prints the tasks it could not complete under a `Failed tasks:` heading. Those `project:target`
 * pairs are the most precise "run this locally" instruction the log contains.
 */
function findFailedNxTasks(lines) {
  const tasks = new Set();
  lines.forEach((line, index) => {
    if (!/^ *Failed tasks:/.test(line)) {
      return;
    }
    for (let cursor = index + 1; cursor < Math.min(index + 30, lines.length); cursor++) {
      const match = lines[cursor].match(/^ *- ([\w@/.-]+:[\w:.-]+)$/);
      if (match) {
        tasks.add(match[1]);
      } else if (lines[cursor].trim() && !lines[cursor].startsWith(' ')) {
        break;
      }
    }
  });
  return [...tasks];
}

/**
 * How far after a matched line to keep. A wide window is what captures a replayed task log, but it
 * must stop at the next group so a failed Nx task does not drag in the output of the ones that
 * succeeded after it.
 */
function endOfContext(lines, matchIndex, after) {
  const limit = Math.min(lines.length - 1, matchIndex + after);
  for (let cursor = matchIndex + 1; cursor <= limit; cursor++) {
    if (lines[cursor].startsWith('##[group]')) {
      return cursor - 1;
    }
  }
  return limit;
}

/** Merge overlapping/adjacent [start, end] ranges so the excerpt does not repeat context lines. */
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 3) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Pull the explanatory part out of one job log.
 *
 * @param {string} rawLog full job log as downloaded from the run's log archive
 * @param {{ maxLines?: number, tailLines?: number }} [options]
 */
export function distillJobLog(rawLog, { maxLines = 450, tailLines = 60 } = {}) {
  const lines = cleanLog(rawLog);
  const steps = splitSteps(lines);

  // The runner emits `##[error]` inside the failing step's own output, before the next group opens.
  const failingStep =
    [...steps].reverse().find((step) => step.lines.some((line) => line.startsWith('##[error]'))) ?? steps[steps.length - 1];

  const stepLines = trimPostStepOutput(failingStep.lines);
  const suppressed = suppressedBlockIndices(stepLines);
  const skip = (index) => suppressed.has(index) || isNoise(stepLines[index]);
  const contentLines = stepLines.filter((line, index) => line.trim() && !skip(index)).length;

  const framework = detectFramework(
    failingStep.command,
    stepLines.filter((_, index) => !suppressed.has(index)),
  );
  const failedNxTasks = findFailedNxTasks(stepLines);

  const ranges = [];
  stepLines.forEach((line, index) => {
    if (skip(index)) {
      return;
    }
    for (const { pattern, before, after } of SIGNAL_PATTERNS) {
      if (pattern.test(line)) {
        ranges.push({ start: Math.max(0, index - before), end: endOfContext(stepLines, index, after) });
        break;
      }
    }
  });
  // Falling back to the tail only helps when nothing matched. Once a signal has been found, the end
  // of a step is usually the *successful* work Nx replayed after the failure, so keeping it hurts.
  if (!ranges.length) {
    ranges.push({ start: Math.max(0, stepLines.length - tailLines), end: stepLines.length - 1 });
  }

  const merged = mergeRanges(ranges);

  const excerptLines = [];
  let omittedLines = 0;
  let previousEnd = -1;
  let truncated = false;

  for (const { start, end } of merged) {
    if (excerptLines.length >= maxLines) {
      truncated = true;
      omittedLines += end - start + 1;
      continue;
    }
    if (previousEnd >= 0 && start > previousEnd + 1) {
      const gap = start - previousEnd - 1;
      omittedLines += gap;
      excerptLines.push(`… ${gap} lines omitted …`);
    }
    for (let cursor = start; cursor <= end; cursor++) {
      if (skip(cursor)) {
        omittedLines++;
        continue;
      }
      excerptLines.push(stepLines[cursor]);
    }
    previousEnd = end;
  }

  if (truncated) {
    excerptLines.push(`… excerpt truncated at ${maxLines} lines — read the full log for the rest …`);
  }

  return {
    framework,
    failingCommand: failingStep.command,
    failedNxTasks,
    excerpt: excerptLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    omittedLines,
    cleanedLog: lines.join('\n'),
    // A step that ran no recognizable tooling and produced almost no output did no work of its
    // own: it is a gate job reporting that a job it depends on failed.
    likelyGateJob: framework === 'unknown' && contentLines < 25,
  };
}

/**
 * A concrete local command that reproduces this class of failure, or null when the failure is a
 * runner/infrastructure problem that cannot be reproduced locally.
 */
export function reproCommandFor(framework, failedNxTasks) {
  if (failedNxTasks.length) {
    return `pnpm nx run ${failedNxTasks[0]}${failedNxTasks.length > 1 ? `   # also failed: ${failedNxTasks.slice(1).join(', ')}` : ''}`;
  }
  switch (framework) {
    case 'playwright':
      return `pnpm start-server-and-test --expect 200 'pnpm start:e2e' http://localhost:3333 'pnpm playwright test <spec> --config apps/jetstream-e2e/playwright.config.ts'`;
    case 'vitest':
      return 'pnpm test:affected';
    case 'typescript':
      return 'pnpm typecheck:affected';
    case 'lint':
      return 'pnpm lint';
    case 'format':
      return 'pnpm format:check';
    case 'build':
      return 'pnpm build:affected';
    case 'database':
      return 'pnpm db:generate && pnpm db:migrate';
    default:
      return null;
  }
}
