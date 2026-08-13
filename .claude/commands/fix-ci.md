---
description: Diagnose and fix a failed CI run — Playwright E2E, unit tests, typecheck, lint or build
argument-hint: '[PR number | run url | --run <id> | --branch <name>] (default: current branch)'
---

CI is red. Your job is to find out **why**, decide whether it should be fixed in the app, in the
test, or not at all, and then fix it. Work through the steps below.

Arguments: `$ARGUMENTS` (e.g. nothing, `1870`, a run/job URL pasted from the browser, `--run <id>`).

## Step 1 — Download the evidence

```
pnpm ci:failures <args>
```

Pass `$ARGUMENTS` straight through — the script takes a PR number, a run/job URL, `--run <id>`,
`--branch <name>`, or nothing (current branch, newest failing run). Add `--force` only if you need
to re-download a bundle you already have.

Let it download the full Playwright report by default: the screenshots, page snapshot and trace it
carries are what make an E2E failure diagnosable. Only pass `--no-report` when the user asks for a
quick look — it reads the small JSON summary instead, which has the errors but none of the evidence
files.

It writes `tmp/ci-failures/<pr-or-branch>-<run-number>/` containing a distilled excerpt per failed
job, the full logs, and — when the run produced a Playwright report — one folder per failed test
with the error, the page snapshot taken at failure, screenshots, console errors and failed requests.

## Step 2 — Orient

Read **`summary.md` only**. It is a few KB and already contains the failing assertion, the code
frame, and where every other piece of evidence lives. Do not read the full `logs/*.log` files unless
the excerpt turns out to be insufficient — they are hundreds of KB of runner noise.

Then establish the blame radius, which is the single most useful triage input:

```
git diff main...HEAD --stat
```

Does this branch touch the code the failure is in — or anything it depends on? Also check
`- Local:` in the summary: if HEAD is not the commit that failed, some of what you find may already
be fixed locally.

## Step 3 — Classify every failure before fixing anything

Failures are listed per job. For each one, decide which of these it is:

| Class           | Signals                                                                                                  | What to do                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Product bug** | The branch touched this area; the test asserts behavior that used to work                                | Fix the app code                                             |
| **Test drift**  | The branch deliberately changed the UI/API the test asserts on                                           | Update the test to the new intended behavior                 |
| **Flake**       | Failure is unrelated to the diff, timing/ordering-dependent, or passed on retry (`FLAKY` in the summary) | Find the race; only fix it if the root cause is clear        |
| **Infra**       | `Detected: infra`, registry/action/runner errors, no repo code involved                                  | Do not touch code — report it and suggest re-running the job |
| **Gate job**    | The summary says the job produced almost no output                                                       | Ignore it; it mirrors another job's failure                  |

A shard failure with `maxFailures` reached means the suite **stopped early** — other tests never
ran, so "only one test failed" is not the same as "only one test is broken."

## Step 4 — Investigate, cheapest evidence first

**Playwright.** Read the per-test folder in this order, stopping as soon as you can explain it:

1. `error.txt` — the failing locator/assertion and the code frame.
2. `page-snapshot.md` — the accessibility tree at the moment of failure. This answers the most
   common question directly: was the element missing entirely, or present under a different
   name/role? Search it for the text the locator was looking for.
3. `screenshot-*.png` — read the image when the snapshot is ambiguous.
4. `console-errors.txt` / `network-failures.txt` — present only when there were any. The summary's
   `- Trace:` line reports the counts; **zero of both means the app was not erroring**, so the
   problem is the locator or the UI state, not a broken request.
5. `trace.zip` via `pnpm exec playwright show-trace <path>` — only if you still cannot explain it,
   and say so rather than guessing.

Then read the spec and the component/page under test and compare against the snapshot.

**Everything else.** The excerpt already contains the compiler/linter/test error and file:line. Open
those files, read the surrounding code, and confirm the cause before changing anything.

## Step 5 — Fix

Fix the **cause**, not the symptom. These are never acceptable:

- Adding `waitForTimeout`/arbitrary sleeps to make a locator resolve
- `test.skip`, `test.fixme`, raising `retries`, or loosening an assertion to make it pass
- `@ts-ignore`, `any`, or disabling a lint rule instead of fixing what it caught
- Weakening a locator (e.g. dropping `exact`) when the real problem is a duplicate element

If the only way you can make it pass is one of those, stop and report that instead — an honest
"this needs a human, here is why" is the correct outcome.

Follow the repo conventions in `CLAUDE.md`, and after editing TypeScript run `pnpm format` and
`pnpm organize-imports <files>`.

## Step 6 — Verify with the narrowest check that proves it

Match the check to the failure — never run the whole suite when one file will do:

| Failure       | Verify with                                             |
| ------------- | ------------------------------------------------------- |
| typecheck     | `pnpm nx run <project>:typecheck`                       |
| unit test     | `pnpm nx test <project>` (add `-- <file>` for one spec) |
| lint / format | `pnpm lint` / `pnpm format:check`                       |
| build         | `pnpm nx run <project>:build`                           |
| Playwright    | See below                                               |

E2E is expensive here: a local run needs the apps built, postgres migrated and seeded, and a live
Salesforce org, and CI shards against a shared org. **Do not run the E2E suite to check a hunch.**
Reason from the evidence and the code. If a run is genuinely warranted, use the exact repro command
from `summary.md` for that one test — it targets a single spec with `-g` — and tell the user what
it requires before running it.

## Step 7 — Report

Summarize, per failure:

- **What failed** — test/job name and the one-line error
- **Classification** — from the table in Step 3
- **Root cause** — what actually went wrong, in one or two sentences
- **Fix** — files changed and why, or why you deliberately did not change anything
- **Verification** — the command you ran and its result. If you could not verify (E2E), say so
  plainly rather than implying it passes
- **Needs a human** — anything unresolved, flaky, or infrastructure-related

Do not commit or push. Leave the bundle in `tmp/` (it is git-ignored) so the user can open the HTML
report or trace themselves.

## Working on several failures at once

If the run has three or more failures that are clearly independent (different jobs, different
subsystems), investigating them in parallel with one subagent each is worthwhile — give each agent
the bundle path, its own failure's section of the summary, and Steps 3-6, then merge the results
into a single report. For one or two failures, do it inline: the context you build reading the first
one usually explains the second.
