# CONTRIBUTING

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## We Develop with Github

We use github to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://docs.github.com/en/get-started/quickstart/github-flow), So All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase (we use [Github Flow](https://docs.github.com/en/get-started/quickstart/github-flow)). We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've added a new feature page, update the documentation. (or mention in the PR that the documentation should be updated)
4. Make sure you have run prettier to format all code.
5. Issue that pull request! 🎉

## Any contributions you make will be under the GNU LESSER GENERAL PUBLIC LICENSE

In short, when you submit code changes, your submissions are understood to be under the same [GNU LESSER GENERAL PUBLIC LICENSE](https://choosealicense.com/licenses/lgpl-3.0/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/jetstreamapp/jetstream/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/jetstreamapp/jetstream/issues); it's that easy!

## Use a Consistent Coding Style

- Ensure that all of your touched files have been formatted by prettier.
  - If you are using VSCode, ensure you have the [prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) installed
  - Your files should be formatted on save if you are using VSCode, you can also Open the command pallette and run **Format Document**
  - If you are using a different editor, ensure that you have manually run prettier to format anything you have modified

## Releasing

### Release notes

User-facing release notes live as MDX files in [`apps/docs/release-notes/`](apps/docs/release-notes/). They are
published to the docs blog at `docs.getjetstream.app/release-notes` and power the in-app "What's New" popover
(via the generated `libs/release-notes/src/lib/release-notes.generated.json`).

**Write the note before you cut the release**, as its own pull request:

1. **Draft** — in Claude Code, run the `/release-notes` command (pass `patch`/`minor`/`major`, or
   `--version X.Y.Z`). It gathers the merged PRs since the last `v*` tag, drafts the MDX in the house
   style, writes it to `apps/docs/release-notes/`, and runs `pnpm release-notes:generate` to validate it.
   - Not in Claude Code? Run `pnpm release-notes:context --bump <level>` and hand the digest to any AI
     assistant along with the guidelines in [`.claude/commands/release-notes.md`](.claude/commands/release-notes.md),
     or scaffold a blank note with `pnpm new-release-note` and write it by hand.
2. **Review** — read and edit the generated MDX. The AI draft is a starting point; the human edit is required.
3. **Open a PR** — branch, commit the new `.mdx` plus the regenerated `release-notes.generated.json`, and
   open a pull request titled `docs: release notes vX.Y.Z`. This runs the normal Docs CI build.
4. **Merge it before running `pnpm release`.** The `release` script warns (non-blocking) if no note exists for
   the upcoming web version.

This keeps every release note — including AI-generated drafts — reviewed and committed exclusively through a
pull request. The automated release workflow never authors or commits release-note content.
