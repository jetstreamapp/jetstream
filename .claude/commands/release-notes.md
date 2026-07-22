---
description: Draft an end-user release note for a just-cut or upcoming release from merged PRs
argument-hint: '[latest | vX.Y.Z | patch|minor|major | --version X.Y.Z] (default: auto-detect)'
---

You are drafting a **user-facing release note** for Jetstream — usually for a release that
was **already cut** (the common flow), sometimes ahead of an upcoming one — and writing it
as an MDX file under `apps/docs/release-notes/`. These notes are published to the Docusaurus
blog at `docs.getjetstream.app/release-notes` and power the in-app "What's New" popover. Work
through the steps below. Do not commit — the human reviews and opens the PR.

Arguments: `$ARGUMENTS` (e.g. nothing, `latest`, `v10.6.0`, `minor`, or `--version 10.4.0`).

## Step 1 — Gather what changed

Run the context script and read its full output:

```
pnpm release-notes:context <args>
```

Map the command argument:

- **No argument** → run with no args. The script auto-detects the mode: if the current
  package.json version is already tagged but has no note yet (release cut first, notes
  after), it targets that tag; otherwise it assumes an upcoming patch release.
- **`latest`, or a tag/version like `v10.6.0` / `10.6.0`** → pass `--tag <value>` — notes
  for an existing, already-cut release. The tag supplies the version, the release date, and
  the commit range (previous `v*` tag → the tag).
- **`patch`/`minor`/`major`** → pass `--bump <level>` — notes for an upcoming,
  not-yet-tagged release.
- **`--version X.Y.Z`** → pass through unchanged (upcoming release, explicit version).

The script prints the resolved mode, target version, release date, and every merged PR in
the release's commit range (title, labels, touched areas, body) plus direct commits. This is
your source material — base the note on it, not on guesses. If it warns that a note already
exists for the version, update that existing file instead of creating a new one.

## Step 2 — Study the house style

Read two existing notes as exemplars for tone, length, and structure:

- `apps/docs/release-notes/2026-04-08-v9.10.0.mdx` (single-platform `web`, rich highlights + an "Other fixes" list)
- `apps/docs/release-notes/2026-04-19-v9.14.0.mdx` (multi-platform `web`/`desktop`/`extension` with a populated `versions` block)

## Step 3 — Draft the MDX

Create `apps/docs/release-notes/<YYYY-MM-DD>-v<version>.mdx` using the target version and date
from Step 1.

### Frontmatter (YAML) — exact shape

```yaml
---
slug: v<version> # e.g. v10.4.0
title: <version> - <short description> # e.g. "10.4.0 - Faster data tables and SSO fixes"
date: '<YYYY-MM-DD>'
tags: [web] # subset of: web, desktop, extension, all (>= 1)
versions: # only the platforms actually releasing
  web: <version>
  # desktop: <version>                 # include only if desktop is releasing
  # extension: <version>               # include only if the extension is releasing
summary: <one or two sentences for the in-app popover>
highlights: # 2-6 items, most important first
  - title: <short, user-facing headline>
    description: <one sentence on what it does for the user>
    docLink: /query/results # OPTIONAL — see "docLink rules" below
---
```

The generator (`pnpm release-notes:generate`) validates this against the Zod schema in
`libs/release-notes/src/lib/release-notes.types.ts`. `tags` and `highlights` are required and
must be non-empty; `summary` is required.

### Tags / versions mapping

Infer platforms from each PR's "touched" areas in the digest:

- `apps/jetstream/`, `apps/api/`, or shared `libs/**` → **web**
- `apps/jetstream-desktop` / `apps/jetstream-desktop-client` → **desktop**
- `apps/jetstream-web-extension` → **extension**
- Use `all` only when a change genuinely ships to every platform.

Put the platform(s) the release ships to in `tags`, and list each releasing platform's version
in `versions`. If you are unsure which platforms a given highlight applies to, set its
`platforms: [...]` field. **Default to `web`** unless the digest clearly shows desktop/extension
changes.

### Body (MDX)

**Tone:** warm, friendly, and end-user-focused — present tense, no emoji, not salesy. Give each
meaningful change real context: what it does, when you'd reach for it, and why it helps — a couple of
sentences, not a terse one-liner. Patch releases can be shorter, but still explain the user-facing
impact of each fix rather than just naming it.

**Audience — leave out internal/technical noise.** These notes are for Salesforce admins and
developers who _use_ Jetstream, not the people who build it. The PR digest is full of engineering
detail that means nothing to them; do not surface it. Every line you keep must read as "what changed
for me, the user." Apply this filter:

- **Remove outright** (no user-visible effect): named dependencies and version bumps (`fast-jwt`,
  `dompurify`, `tar`, `soql-parser-js`, `react-hook-form`, Monaco, Electron, Vite, Zod, etc.),
  generic "dependency upgrades" / "security dependency upgrades" / CVE mentions, framework and state
  internals (React version, Jotai/Recoil), build/tooling/monorepo/CI changes, code-level mechanism
  (function names, "error boundary", CSP / security-headers module, cookie internals), and internal
  vendor/infra names (BetterStack, Cloudinary, log storage locations).
- **Reword to the user-visible effect** when a real fix or behavior change is explained via internals:
  keep the symptom, drop the mechanism. E.g. a `base64ToArrayBuffer` regression → "Fixed an issue
  where metadata downloads could fail"; an Electron heap bump → "Reduced out-of-memory errors on
  large jobs." If you cannot state a concrete user-facing effect, remove the line entirely.
- **Keep** genuine features and user-visible fixes. One deliberate exception worth surfacing:
  **Salesforce API version bumps** (e.g. 64.0 → 65.0) — reword as user-facing ("New org connections
  now use Salesforce API version 65.0"), since they matter to this audience.
- **Maintenance-only releases:** if, after filtering, nothing user-facing remains (a pure
  dependency/security release), do NOT pad it with internals and do NOT leave it empty — the schema
  requires a non-empty `summary` and at least one highlight. Collapse it to a short, honest note:
  - `summary: Behind-the-scenes maintenance and security updates. No changes to how the app works.`
  - one highlight titled `Maintenance and security updates` with description
    `Routine behind-the-scenes updates. No changes to how the app works.`
  - body: a single `### Maintenance and security updates` section saying the release includes routine
    maintenance and security updates with no changes to how the app works.

After the frontmatter, write:

```mdx
{/* truncate */}

## What's new

### <Highlight headline>

<A friendly paragraph or two: what changed, when it's useful, and the benefit. Plain language.>

### Other fixes

- <One sentence per smaller fix — what it does for the user, not just that it changed.>
```

The `{/* truncate */}` marker MUST be present — it sets the blog excerpt boundary.

### MDX-safe body rules (the build fails otherwise)

Docusaurus uses MDX v3, which parses the body as JSX. **Always** wrap these in backticks or a
fenced code block — never leave them bare:

- Angle brackets: `<your-org>`, `Map<string>`, `a < b`
- Curly braces / expressions: `{recordId}`, `${version}`
- Salesforce merge syntax: `{!Field}`

A bare `<word>` or `{ ... }` in prose will break `pnpm --dir apps/docs build`.

### docLink rules (so in-app "Learn more" links resolve)

`docLink` must be the doc's **published route**, which is the `slug` in the target doc's
frontmatter — NOT its file path. Many docs use a flattened slug. Verify before using one:
open the target under `apps/docs/docs/**` and copy its `slug:` value. Common correct routes:
`/query`, `/query/results`, `/load`, `/permissions`, `/deploy-fields`, `/deploy-metadata`,
`/team-management`, `/team-management/sso/overview`. Omit `docLink` if there is no matching doc.

## Step 4 — Validate

```
pnpm release-notes:generate
```

This re-parses every note, validates the new one against the schema, and refreshes
`apps/docs/static/release-notes.json` — the file the docs site serves at
`docs.getjetstream.app/release-notes.json` and the in-app popover fetches at runtime.
Fix any reported errors. If you want to be thorough, run `pnpm --dir apps/docs build` to confirm
the MDX compiles (slower; catches bare `<`/`{` issues).

## Step 5 — Hand off

Tell the user the file was written and validated, summarize the highlights you chose, and remind
them to:

1. Review/edit the wording.
2. Commit `apps/docs/release-notes/<file>.mdx` + the regenerated
   `apps/docs/static/release-notes.json` on a branch and open a PR titled
   `docs: release notes v<version>`. Both files live under `apps/docs/`, so only the Docs CI
   workflow runs on the PR.
3. For an **already-cut release**, just merge — the note goes live on the docs site (and in
   the in-app popover) once the docs deploy completes. For an **upcoming release**, merge the
   PR **before** cutting the release (`pnpm release`).
