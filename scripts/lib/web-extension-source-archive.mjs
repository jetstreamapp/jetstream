/**
 * What goes into the web extension's source archive, the human-readable source that addons.mozilla.org
 * requires next to the minified build. Shared by the script that builds the archive and the one that
 * uploads it, so the upload can refuse an archive that holds anything else.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { $ } from 'zx';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

/**
 * Files a source archive must never contain. Checked even though only tracked files are archived, so a
 * key or log that is ever committed by mistake fails the build instead of being uploaded.
 */
const FORBIDDEN_SOURCE_ARCHIVE_PATTERNS = [
  /\.(p8|p12|pfx|pem|key|provisionprofile|log)$/i,
  /(^|\/)\.env/,
  /(^|\/)(build-resources|logs|certificates|playwright-report|test-results)\//,
];

function findForbiddenFiles(filePaths) {
  return filePaths.filter((filePath) => FORBIDDEN_SOURCE_ARCHIVE_PATTERNS.some((pattern) => pattern.test(filePath)));
}

/**
 * The files that make up the extension's source: tracked files only, read from the working tree so a
 * version bump that has not been committed yet is included. Walking the directory instead would also
 * pick up anything gitignored, such as signing keys, logs and test reports. Dot paths are left out,
 * matching what the archive has always held.
 */
export async function listSourceArchiveFiles(sourceDir) {
  const { stdout } = await $({ cwd: sourceDir, quiet: true })`git ls-files -z --cached`;
  const sourceFiles = stdout
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => {
      const isDotPath = filePath.split('/').some((segment) => segment.startsWith('.'));
      // A tracked file that was deleted in the working tree is still listed by git
      return !isDotPath && existsSync(join(sourceDir, filePath));
    });

  const forbiddenFiles = findForbiddenFiles(sourceFiles);
  if (forbiddenFiles.length > 0) {
    throw new Error(`Refusing to build the source archive, these files must not be published:\n${forbiddenFiles.join('\n')}`);
  }
  return sourceFiles;
}

/**
 * Throws unless every file in an existing source archive is one `listSourceArchiveFiles` would include,
 * so an archive built some other way (or by an older version of the zip script) is never uploaded.
 */
export async function assertSourceArchiveIsPublishable(sourceDir, archivePath) {
  const allowedFiles = new Set(await listSourceArchiveFiles(sourceDir));
  const archive = await JSZip.loadAsync(await readFile(archivePath));
  const archivedFiles = Object.values(archive.files)
    .filter(({ dir }) => !dir)
    .map(({ name }) => name);

  const unexpectedFiles = archivedFiles.filter((filePath) => !allowedFiles.has(filePath));
  if (unexpectedFiles.length > 0) {
    const preview = unexpectedFiles.slice(0, 20).join('\n');
    const remainder = unexpectedFiles.length > 20 ? `\n...and ${unexpectedFiles.length - 20} more` : '';
    throw new Error(
      `${archivePath} contains files that are not tracked source files. Rebuild it with \`pnpm build:web-extension:zip\`.\n${preview}${remainder}`,
    );
  }
}
