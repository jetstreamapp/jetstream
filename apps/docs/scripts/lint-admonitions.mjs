/**
 * Fail the build when an admonition has a space-separated title.
 *
 * `:::tip Some Title` is invalid in Docusaurus 3 — MDX silently renders the entire block as
 * literal text (including the `:::` fences) instead of an admonition, and the build still
 * succeeds. Titles must use the bracket form `:::tip[Some Title]`, or be omitted entirely.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const docsRoot = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_DIRS = ['docs', 'release-notes'];
const INVALID_ADMONITION_TITLE = /^\s*:{3,}[a-zA-Z][\w-]*[ \t]+\S/;

function collectMarkdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownFiles(fullPath);
    }
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const violations = [];
for (const contentDir of CONTENT_DIRS) {
  for (const file of collectMarkdownFiles(join(docsRoot, contentDir))) {
    // Content inside fenced code blocks renders literally, so the invalid pattern is fine there
    // (e.g. a doc showing the broken syntax as an example).
    let openingFence = null;
    readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, index) => {
        const fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
        if (fence) {
          if (!openingFence) {
            openingFence = fence;
          } else if (fence[0] === openingFence[0] && fence.length >= openingFence.length) {
            openingFence = null;
          }
          return;
        }
        if (!openingFence && INVALID_ADMONITION_TITLE.test(line)) {
          violations.push(`${file}:${index + 1}\n    ${line.trim()}`);
        }
      });
  }
}

if (violations.length) {
  console.error(
    [
      `Found ${violations.length} admonition(s) with a space-separated title, which Docusaurus 3 renders as literal text:`,
      '',
      ...violations,
      '',
      'Use the bracket form instead (`:::tip[Some Title]`), or drop the title (`:::tip`).',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('Admonition check passed');
