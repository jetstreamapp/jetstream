#!/usr/bin/env zx
/**
 * Reads MDX release notes from apps/docs/release-notes/, validates frontmatter
 * against the Zod schema in libs/release-notes, and writes a sorted JSON array
 * to libs/release-notes/src/lib/release-notes.generated.json.
 *
 * Run via: yarn release-notes:generate
 *         or: nx run release-notes:build-data
 */
import matter from 'gray-matter';
import { chalk, fs, globby, path } from 'zx';
import { releaseNoteFrontmatterSchema, releaseNotesArraySchema } from '../libs/release-notes/src/lib/release-notes.types.ts';
import type { ReleaseNote } from '../libs/release-notes/src/lib/release-notes.types.ts';

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'apps/docs/release-notes');
const OUTPUT_FILE = path.join(ROOT, 'libs/release-notes/src/lib/release-notes.generated.json');

const files = await globby('*.mdx', { cwd: SOURCE_DIR, absolute: true });

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
    errors.push({ file: path.relative(ROOT, file), issues: parsed.error.issues });
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
await fs.writeFile(OUTPUT_FILE, JSON.stringify(validated.data, null, 2) + '\n');

console.log(
  chalk.greenBright(`Wrote ${notes.length} release note${notes.length === 1 ? '' : 's'} → ${path.relative(ROOT, OUTPUT_FILE)}`),
);

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
