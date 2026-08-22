---
name: conventional-commit
description: Write a commit message for the current changes - conventional commit format, a short body, issue references in the footer. Use whenever asked to write, draft, revise, or shorten a commit message, or to commit staged work. Also applies to PR descriptions, since the commit message doubles as one.
---

# Commit messages

Commitlint runs on every commit via `.husky/commit-msg`, and the header feeds the
generated `CHANGELOG.md`, so the header is public and permanent. The body is for
the next developer who runs `git blame` on a line that looks wrong - not for the
end user, and not as a tour of the diff.

## Shape

```
type(scope): subject

Why this change, plus anything a reader could not infer from the diff.

Closes #123
```

## Length

Default to short. Most commits need a subject and nothing else. The recent
history is full of six-paragraph bodies; those are the anti-pattern, not the
model.

| Change                                                                | Body                                |
| --------------------------------------------------------------------- | ----------------------------------- |
| Formatting, deps, renames, config, obvious one-liners                 | None                                |
| Ordinary fix or feature                                               | 1-3 sentences                       |
| Non-obvious tradeoff, subtle bug, decision that will look wrong later | Up to 8 lines, or 3-5 short bullets |

Hard ceiling: **12 lines of body**. Past that, cut - do not keep wrapping.

A commit body is not a design doc, a changelog entry, or a release note.
User-facing framing belongs in the release notes under `apps/docs/release-notes/`,
which are written separately (see `.claude/commands/release-notes.md`).

## Subject

- `type(scope): subject`, imperative mood, no trailing period.
- Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `ci`
  `build` `revert`.
- Target 72 characters. 120 is the enforced maximum, not a goal.
- Scope is optional - use the app or lib the change is confined to (`query`,
  `desktop`, `data-table`, `deploy`, `api`, `ui`, `load`), and drop it when the
  change spans several.
- Only `feat` and `fix` appear in the changelog, where the subject stands alone
  beside thirty others with no body for context. `fix: handle null` tells a
  reader nothing. This does:
  `fix(query): stop in-flight field fetches from clobbering the current object`

## Body

Wrap at 80 columns. Include only what passes this test: **would the diff alone
leave a competent reader guessing?**

Worth a line:

- Why the change was needed - the symptom, the user report, the constraint.
- A decision that looks wrong without context ("prunes the built tree rather
  than rebuilding it, because rebuilding reassigns folder ids").
- An alternative that was rejected, in one sentence, when someone will otherwise
  try it.
- A behavior change the subject does not imply.

Not worth a line:

- Restating the diff, or listing the files and functions touched.
- Test setup, formatter runs, lint fixes, import reordering.
- Anything already obvious from the subject.
- Narrating each branch of the implementation.

Never write a bare `#123` in body prose. conventional-changelog scrapes it as a
separate reference, so the entry renders as
`closes [#1147] [#1448], references [#1147] [#1448]` - see commit `381fdae`.
Name the issue as "the reported stall" in prose and put the number in the footer.

## Footer

Issue references go at the bottom, after a blank line, one per line - **never in
the middle of the message**, even when one commit closes two tickets:

```
Closes #123
Closes #456
```

`Closes` and `Fixes` close the issue when the PR merges. `Refs` links without
closing.

## Workflow

1. Read the whole change first: `git status`, then `git diff` (or
   `git diff --cached` when something is already staged).
2. `git log --oneline -10` to match current subject conventions.
3. Stage what belongs in this commit.
4. Draft, then cut. Of every body line ask: does this still earn its place in a
   year?
5. Commit with a heredoc so the wrapping survives. Commitlint runs on the hook -
   if it rejects the message, fix the message rather than bypassing the hook.

## Example

A "Hide Unchanged Files" filter for the metadata compare tree. The over-long
version ran six paragraphs: both checkboxes, the new help text, the file count,
the folder-id reasoning, the tree selection fallback, and the vitest config. All
but one of those is visible in the diff.

```
feat(deploy): hide unchanged files when comparing metadata between orgs

A metadata compare routinely returns hundreds of components where only a
handful differ, and the tree had no filter. A "Hide Unchanged Files"
checkbox now sits above the tree with a "Showing X of Y files" count.
Deploy Changes still offers every changed component regardless of the
filter.

The filter prunes the built tree instead of rebuilding it from a filtered
file list. buildTree derives folder ids from the first file it sees in
each folder, so rebuilding would collapse every folder the user had
expanded.

Closes #123
```

The second paragraph survives because a future reader would otherwise "simplify"
it back into a rebuild and silently break the expanded state.
