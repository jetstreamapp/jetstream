#!/usr/bin/env node

/**
 * Regenerates the list of released managed package versions shown on the docs site
 * (apps/docs/docs/getting-started/managed-package).
 *
 * The Dev Hub is the source of truth, so the whole file is rebuilt from `sf package version list`
 * on every run rather than appended to. That keeps the docs correct after a failed release, a
 * manual promote, or a release cut from a hotfix branch.
 *
 * Only released (promoted) versions are listed: beta versions cannot be installed in production orgs.
 *
 * Run directly to refresh the file without cutting a release:
 *   node apps-sfdx/scripts/sfdx/docs-package-versions.mjs
 * This uses the default Dev Hub, or set SF_TARGET_DEV_HUB to pick one.
 *
 * Uses only Node built-ins so CI does not need to install apps-sfdx dependencies.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sfdxProjectDir = path.resolve(scriptDir, '../..');

export const DOCS_PACKAGE_VERSIONS_FILE = path.resolve(sfdxProjectDir, '../apps/docs/src/data/managed-package-versions.json');

/**
 * Fetches the released versions of the package from the Dev Hub, newest first.
 * Throws if the Dev Hub cannot be queried or returns nothing, so a bad response never empties the docs.
 */
export function fetchReleasedPackageVersions(packageName) {
  const stdout = execFileSync('sf', ['package', 'version', 'list', '--packages', packageName, '--released', '--json'], {
    cwd: sfdxProjectDir,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024
  });
  const packageVersions = JSON.parse(stdout)?.result;
  if (!Array.isArray(packageVersions) || packageVersions.length === 0) {
    throw new Error(`No released versions returned for package "${packageName}".`);
  }

  return packageVersions
    .filter(({ IsReleased, SubscriberPackageVersionId }) => IsReleased && SubscriberPackageVersionId)
    .sort(
      (versionA, versionB) =>
        versionB.MajorVersion - versionA.MajorVersion ||
        versionB.MinorVersion - versionA.MinorVersion ||
        versionB.PatchVersion - versionA.PatchVersion ||
        versionB.BuildNumber - versionA.BuildNumber
    )
    .map(({ MajorVersion, MinorVersion, PatchVersion, SubscriberPackageVersionId, CreatedDate }) => ({
      version: `${MajorVersion}.${MinorVersion}.${PatchVersion}`,
      packageVersionId: SubscriberPackageVersionId,
      // CreatedDate is "YYYY-MM-DD HH:mm"; the docs only show the day
      releaseDate: String(CreatedDate).slice(0, 10)
    }));
}

export function writeDocsPackageVersions(packageName) {
  const versions = fetchReleasedPackageVersions(packageName);
  writeFileSync(DOCS_PACKAGE_VERSIONS_FILE, `${JSON.stringify(versions, null, 2)}\n`);
  return versions;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const versions = writeDocsPackageVersions('Jetstream for Salesforce');
  console.log(`Wrote ${versions.length} released version(s) to ${DOCS_PACKAGE_VERSIONS_FILE}`);
}
