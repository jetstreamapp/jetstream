#!/usr/bin/env zx
/**
 * Reads MDX release notes from apps/docs/release-notes/, validates frontmatter
 * against the Zod schema in libs/release-notes, and writes a sorted JSON array
 * to apps/docs/static/release-notes.json, which Docusaurus serves at
 * https://docs.getjetstream.app/release-notes.json for the in-app "What's New"
 * popover to fetch at runtime. Keeping both the MDX and the generated JSON in
 * apps/docs means release-note PRs only trigger the Docs CI workflow.
 *
 * Run via: pnpm release-notes:generate
 */
import matter from 'gray-matter';
import { format } from 'oxfmt';
import { chalk, fs, globby, path } from 'zx';
import type { ReleaseNote, ReleaseNoteFrontmatter } from '../libs/release-notes/src/lib/release-notes.types.ts';
import { releaseNoteFrontmatterSchema, releaseNotesArraySchema } from '../libs/release-notes/src/lib/release-notes.types.ts';

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'apps/docs/release-notes');
const DOCS_DIR = path.join(ROOT, 'apps/docs/docs');
const OUTPUT_FILE = path.join(ROOT, 'apps/docs/static/release-notes.json');

const files = await globby('*.mdx', { cwd: SOURCE_DIR, absolute: true });
const docRoutes = await collectDocRoutes();

if (files.length === 0) {
  console.log(chalk.yellow(`No MDX files found in ${path.relative(ROOT, SOURCE_DIR)}; writing empty array.`));
}

const errors: Array<{ file: string; issues: Array<{ path?: readonly (string | number)[]; message: string }> }> = [];
const notes: ReleaseNote[] = [];

for (const file of [...files].sort()) {
  const raw = await fs.readFile(file, 'utf8');
  const { data } = matter(raw);
  const parsed = releaseNoteFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    // Zod issue paths may contain symbols; normalize so they satisfy the local issue shape.
    errors.push({
      file: path.relative(ROOT, file),
      issues: parsed.error.issues.map(({ path: issuePath, message }) => ({ path: issuePath.map(String), message })),
    });
    continue;
  }
  const normalizedDate = normalizeDate(parsed.data.date);
  if (!normalizedDate) {
    errors.push({
      file: path.relative(ROOT, file),
      issues: [{ path: ['date'], message: `Invalid date "${String(parsed.data.date)}" — expected YYYY-MM-DD.` }],
    });
    continue;
  }
  const docLinkIssues = validateDocLinks(parsed.data, docRoutes);
  if (docLinkIssues.length) {
    errors.push({ file: path.relative(ROOT, file), issues: docLinkIssues });
    continue;
  }
  notes.push({ ...parsed.data, date: normalizedDate });
}

if (errors.length) {
  console.error(chalk.red(`\nFailed to parse ${errors.length} release-note file${errors.length > 1 ? 's' : ''}:\n`));
  for (const { file, issues } of errors) {
    console.error(chalk.red(`  ${file}`));
    for (const issue of issues) {
      const loc = (issue.path ?? []).join('.') || '(root)';
      console.error(chalk.red(`    • ${loc}: ${issue.message}`));
    }
  }
  process.exit(1);
}

notes.sort((noteA, noteB) => {
  if (noteA.date !== noteB.date) {
    return noteA.date < noteB.date ? 1 : -1;
  }
  return compareSemver(noteB.slug, noteA.slug);
});

const validated = releaseNotesArraySchema.safeParse(notes);
if (!validated.success) {
  console.error(chalk.red('Post-normalization validation failed:'));
  console.error(validated.error.issues);
  process.exit(1);
}

await fs.ensureDir(path.dirname(OUTPUT_FILE));
// Format with oxfmt so the generated file matches what `pnpm format` would produce,
// otherwise editors and pre-commit formatting reflow the whole file on unrelated edits.
const oxfmtConfig = await fs.readJson(path.join(ROOT, '.oxfmtrc.json'));
const { code: formatted } = await format(OUTPUT_FILE, JSON.stringify(validated.data), {
  printWidth: oxfmtConfig.printWidth,
  singleQuote: oxfmtConfig.singleQuote,
});
await fs.writeFile(OUTPUT_FILE, formatted);

console.log(chalk.greenBright(`Wrote ${notes.length} release note${notes.length === 1 ? '' : 's'} → ${path.relative(ROOT, OUTPUT_FILE)}`));

/**
 * Published routes of every doc page, taken from the `slug` frontmatter under apps/docs/docs/.
 * Highlight `docLink`s must point at one of these — the in-app "Learn more" links resolve against
 * the live docs site, so an unknown route ships a 404 to users. Files with a `_` prefix are
 * Docusaurus partials and never get a route.
 */
async function collectDocRoutes(): Promise<Set<string>> {
  const docFiles = await globby(['**/*.mdx', '**/*.md'], { cwd: DOCS_DIR, absolute: true });
  const routes = new Set<string>();
  for (const file of docFiles) {
    if (path.basename(file).startsWith('_')) {
      continue;
    }
    const { data } = matter(await fs.readFile(file, 'utf8'));
    if (typeof data.slug === 'string' && data.slug.length > 0) {
      routes.add(normalizeRoute(data.slug));
    }
  }
  return routes;
}

function normalizeRoute(route: string): string {
  const withLeadingSlash = route.startsWith('/') ? route : `/${route}`;
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

/**
 * Every internal docLink (and internal cta.href) must match a real doc slug. Absolute
 * http(s) URLs are allowed as-is — the popover passes them through untouched.
 */
function validateDocLinks(
  note: ReleaseNoteFrontmatter,
  validRoutes: Set<string>,
): Array<{ path: readonly (string | number)[]; message: string }> {
  const issues: Array<{ path: readonly (string | number)[]; message: string }> = [];
  const check = (link: string | undefined, issuePath: readonly (string | number)[]) => {
    if (!link || /^https?:\/\//i.test(link)) {
      return;
    }
    const route = normalizeRoute(link.split('#')[0]);
    if (!validRoutes.has(route)) {
      issues.push({
        path: issuePath,
        message: `"${link}" does not match the slug of any doc under apps/docs/docs — the in-app "Learn more" link would 404. Use the target doc's frontmatter slug, or remove the link.`,
      });
    }
  };
  note.highlights.forEach((highlight, index) => check(highlight.docLink, ['highlights', index, 'docLink']));
  check(note.cta?.href, ['cta', 'href']);
  return issues;
}

function compareSemver(a: string, b: string): number {
  const parse = (slug: string) =>
    slug
      .replace(/^v/, '')
      .split('.')
      .map((segment) => parseInt(segment, 10) || 0);
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) {
    return aMajor - bMajor;
  }
  if (aMinor !== bMinor) {
    return aMinor - bMinor;
  }
  return aPatch - bPatch;
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}
