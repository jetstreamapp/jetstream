---
name: conventional-commit
description: Generate conventional commit messages following project commitlint rules.
---

## Workflow

1. Run `git status` and `git diff --cached` (or `git diff` if nothing staged) to understand the changes.
2. Stage relevant files with `git add <file>`.
3. Construct a commit message following the rules below and run `git commit`.

## Rules

- **Format**: `type(scope): description`
- **Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`
- **Scope**: Optional but recommended for clarity.
- **Description**: Imperative mood (e.g., "add", not "added").
- **Body/footer**: Optional. No line length restrictions. Reference github issues if applicable (e.g., `Closes #123`).
- **Case**: No restrictions on subject casing.
- **Length**: No max length enforced for body, or footer; header is limited to 120 characters and is used to generate the changelog, so should be concise and descriptive.


Full rules are defined in `commitlint.config.js`.
