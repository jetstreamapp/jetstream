---
name: gh-bot-comment
description: Post GitHub PR/issue comments, reviews, and review replies as the Jetstream bot account instead of the user's personal account. Use whenever asked to comment on a PR, leave a code review on a PR, reply to review threads, or comment on an issue via gh/the GitHub API.
---

# Posting to GitHub as the bot account

Any **write** to PR or issue conversations (comments, reviews, review replies) must be
posted as the app's bot account, not the user's personal account. A GitHub App
installation token does this automatically - anything posted with it shows up as
`<app-slug>[bot]`.

Mint the token and run the command in one step:

```bash
pnpm gh:bot run gh pr comment 1234 --body-file /path/to/comment.md
pnpm gh:bot run gh issue comment 1234 --body "..."
pnpm gh:bot run gh api repos/jetstreamapp/jetstream/pulls/1234/reviews -f event=COMMENT -f body='...'
```

`pnpm gh:bot run <cmd...>` executes the command with `GH_TOKEN` and `GITHUB_TOKEN` set to a
fresh installation token (cached ~50 minutes in `tmp/gh-app-token/`). This also sidesteps any
stale `GH_TOKEN` in the user's shell environment.

If a command needs the raw token instead, use `GH_TOKEN=$(pnpm --silent gh:bot token)` - the
`--silent` flag matters, or pnpm's banner ends up inside the token.

## When NOT to use it

- **The user explicitly asks to post as themselves** ("as me", "from my account") - use plain
  `gh`. The bot is only the default, not a requirement.
- **Reads** (`gh pr view`, `gh pr diff`, `gh api` GETs) - use plain `gh`; no bot identity needed.
- **git push / PR creation from the user's own branches** - those should stay attributed to the
  user unless they say otherwise.

## Notes

- The token is scoped to `pull_requests: write` + `issues: write` on this repository only; it
  cannot push code or cut releases.
- `gh pr comment` posts an issue comment; for line-anchored review comments or a batched review,
  use `gh api .../pulls/{n}/reviews` with a `comments` array payload.
- If the script errors, surface its message to the user rather than falling back to posting as
  the personal account - a permissions error means the GitHub App needs "Pull requests: Read and
  write" / "Issues: Read and write" granted in its settings.
- Sanity check identity with `pnpm gh:bot whoami`.
