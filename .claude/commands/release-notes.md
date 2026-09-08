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

The script prints the resolved mode, target version, release date, the desktop and extension
releases cut in the range (plus the current desktop/extension versions), and every merged PR in
the release's commit range (title, labels, touched areas, body) plus direct commits. This is
your source material — base the note on it, not on guesses. If it warns that a note already
exists for the version, update that existing file instead of creating a new one.

## Step 2 — Study the house style

Read two existing notes as exemplars for tone, length, and structure:

- `apps/docs/release-notes/2026-04-08-v9.10.0.mdx` (single-platform `web`, rich highlights + an "Other fixes" list)
- `apps/docs/release-notes/2026-04-19-v9.14.0.mdx` (multi-platform `web`/`desktop`/`extension` with a populated `versions` block)

Do NOT treat the most recent notes as style anchors — several (roughly v10.5.0 through v10.11.0)
drifted long and salesy and are the style we are moving away from. Match the two files above.

## Step 3 — Draft the MDX

Create `apps/docs/release-notes/<YYYY-MM-DD>-v<version>.mdx` using the target version and date
from Step 1.

### Frontmatter (YAML) — exact shape

```yaml
---
slug: v<version> # e.g. v10.4.0
title: <version> - <short description> # e.g. "10.4.0 - Faster data tables and SSO fixes"
date: '<YYYY-MM-DD>'
tags: [web, desktop, extension] # every platform whose users receive the changes, see "Tags / versions mapping"
versions: # for each tagged platform, the release that carries the changes
  web: <version>
  desktop: <version> # omit only when desktop is not tagged
  extension: <version> # omit only when the extension is not tagged
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

`tags` decides who sees the note. The in-app What's New popover
(`libs/release-notes/src/lib/release-notes-utils.ts`) shows a note only on platforms listed in its
`tags`, and hides any highlight whose `platforms` field excludes the viewer's platform. A note tagged
only `web` is never shown to desktop or extension users, even when they received the feature. So
`tags` must list every platform whose users receive the changes, not just the platform whose release
you happen to be writing about.

Jetstream is one codebase: the web app, the desktop app and the browser extension all mount the same
feature libraries, and the desktop and extension releases are normally cut minutes after the web
release from the same commit. Decide per change, then take the union:

- **Shared feature or shared UI change** → **web, desktop, extension**. This is anything under
  `libs/features/**`, `libs/shared/**`, `libs/ui/**`, or any app page (Query, Load Records, Update
  Records, Automation Control, Manage Permissions, Permission Analysis, Deploy Metadata, Create Fields,
  Formula Evaluator, Record Type Manager, Anonymous Apex, Apex Tests, Debug Logs, Platform Events,
  Salesforce API, Export Object Metadata, Data History, field usage analysis) plus cross-cutting UI
  (data tables, editors, header and navigation, org dropdown, keyboard shortcuts, record modals, file
  exports). The desktop app mounts every page. The extension mounts every page except Create Records
  and Org Groups; when unsure, check the `<Route>` list in
  `apps/jetstream-web-extension/src/pages/app/App.tsx`.
- **Web-only surface** (`apps/jetstream/` or `apps/api/` only) → **web**: login, signup, MFA,
  passkeys, profile, billing and subscriptions, team management, SSO, the web "add org" OAuth flow,
  PWA, Salesforce Canvas, the landing and docs sites, server-only behaviour.
- **Desktop-only** (`apps/jetstream-desktop*`) → **desktop**: auto-update, installers, menus,
  desktop settings, local org storage. Add **web** as well when the surface is the website's
  download page.
- **Extension-only** (`apps/jetstream-web-extension`) → **extension**: popup, Salesforce page
  injection, extension permissions and manifest, extension login.

Never use `all`; list the platforms explicitly. The context script prints each PR's touched areas,
labelling shared libraries by their reach, and lists the desktop and extension releases cut in the
range, so the digest alone is usually enough to decide.

When the union spans more than one platform, set `platforms: [...]` on every highlight that does not
reach all of them (a billing fix in an otherwise shared release gets `platforms: [web]`), so the
popover does not show desktop users a web-only bullet. Highlights that reach every tagged platform
need no `platforms` field.

`versions` lists, for each tagged platform, the release that carries the changes:

- **Already-cut release:** use the `desktop-v*` / `web-ext-v*` tags the context script lists for the
  range (they are cut minutes after the web tag).
- **Upcoming release:** the next desktop/extension version, i.e. a bump of the current
  `apps/jetstream-desktop/package.json` and `apps/jetstream-web-extension/src/manifest.json` versions
  (the context script prints both). Say in the handoff that those platforms must be selected in the
  `pnpm release` platform picker. If the human decides not to cut a tagged platform, drop it from both
  `tags` and `versions` before merging, since its users would otherwise see a note for changes they do
  not have.

### Voice and style

These notes should read like a changelog written by the engineer who built the feature: plain,
direct, specific, present tense, no emoji. Friendly is fine; enthusiastic is not. The reader is
skimming — optimize for "understood in one pass," not for warmth.

**Length caps (hard limits):**

- `summary`: one or two plain sentences naming the top change(s). No "plus ..." chains.
- highlight `title`: name the feature plainly, no cleverness.
- highlight `description`: one sentence.
- Body feature sections: two to four sentences. When a feature has several distinct behaviors,
  use a short bullet list instead of packing them into a paragraph.
- "Other fixes" bullets: one sentence each.

**Banned — each of these is a tell that the note was AI-generated:**

- Em-dashes (`—`) anywhere in the note. Use a period, a comma, or parentheses instead. (The plain
  hyphen in the `10.4.0 - short description` title format is fine.)
- Hype and evaluative wording: "big upgrade", "powerful", "noticeably", "snappier", "seamless",
  "massive", "supercharged", "a lot more ...", "better than ever".
- Flourishes and cute imagery: "trapped on screen", "at the mercy of", "quietly makes",
  "just got", exclamation marks.
- The triple-list-with-a-twist rhythm in summaries and titles ("X, Y, and Z — plus W").
- "so you can ..." tails that restate the obvious ("copy a column so you can get it onto your
  clipboard").

**Benefits:** state a benefit only when it is not obvious from the change itself, and make it
concrete ("lowering the batch size helps when records fire heavy automation and hit governor
limits"), never aspirational. When the change speaks for itself, describe it and stop.

**Accuracy — never invent motivation.** Only claim why something was built, or what was broken
before, if the PR digest actually says so. PR bodies in the digest are truncated: if a significant
change is under-described, run `gh pr view <number>` for the full body or `gh pr diff <number>` and
read the real change instead of guessing. If you still cannot tell, describe the new behavior
without a backstory — a wrong "previously, X was broken" claim is worse than no context.

### Body (MDX)

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

<Two to four plain sentences: what changed and how to use it. Bullet list if the feature has
several distinct behaviors.>

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

`pnpm release-notes:generate` fails on any `docLink` that does not match a real doc slug, but
that only proves the page exists — you are still responsible for the page actually covering the
feature. Never invent a route, and never link a doc that merely sounds related.

Validation runs against the doc files in your **working tree**, not the live site, so a doc page
added in the same branch or PR passes even though it has not deployed yet (they deploy together).
If the doc page does not exist in the tree at all — for example it will be written later — omit
`docLink` now and add it in the PR that creates the doc, rather than linking a route that would
404 in the meantime.

## Step 4 — Validate and proofread

```
pnpm release-notes:generate
```

This re-parses every note, validates the new one against the schema, **verifies every `docLink`
against the real doc slugs under `apps/docs/docs/**`**, and refreshes
`apps/docs/static/release-notes.json` — the file the docs site serves at
`docs.getjetstream.app/release-notes.json` and the in-app popover fetches at runtime.
Fix any reported errors. If you want to be thorough, run `pnpm --dir apps/docs build` to confirm
the MDX compiles (slower; catches bare `<`/`{` issues).

Then two final passes over the file you wrote:

1. **Style check:** `grep -n '—' apps/docs/release-notes/<file>.mdx` must return nothing.
   While you're at it, re-scan for the banned wording from the Voice section and cut any
   sentence that reads like marketing.
2. **Grammar proofread:** re-read the note once for grammar alone — subject-verb agreement with
   feature names ("Manage Permissions lets", not "let"), missing articles, consistent present
   tense, its/it's. Review bots flag exactly these on the release-note PR, so catch them here.

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
   PR **before** cutting the release (`pnpm release`), and select every platform listed in
   `versions` in the release script's platform picker so the note matches what ships.
