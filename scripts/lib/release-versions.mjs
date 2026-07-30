/**
 * Shared version metadata for the three independently released applications.
 *
 * Each application tracks its version in its own file and tags with its own
 * prefix, so a single commit can carry a release for any combination of them.
 * Used by `scripts/release.mjs` (preview) and `scripts/sync-hotfix-versions.mjs`
 * (run by the release workflow on hotfix branches).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'zx';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** `key` matches the platform values used by `scripts/release.mjs` and the release workflow inputs. */
export const RELEASE_TARGETS = [
  {
    key: 'web',
    label: 'web',
    versionFile: 'package.json',
    tagPattern: 'v[0-9]*',
    tagPrefix: 'v',
  },
  {
    key: 'extension',
    label: 'extension',
    versionFile: 'apps/jetstream-web-extension/src/manifest.json',
    tagPattern: 'web-ext-v*',
    tagPrefix: 'web-ext-v',
  },
  {
    key: 'desktop',
    label: 'desktop',
    versionFile: 'apps/jetstream-desktop/package.json',
    tagPattern: 'desktop-v*',
    tagPrefix: 'desktop-v',
  },
];

const STABLE_VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Parses a stable `X.Y.Z` version into numeric segments. Prereleases return null — they never count as released. */
export function parseVersion(value) {
  const match = STABLE_VERSION_REGEX.exec(String(value ?? '').trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Comparator for stable version strings. Anything unparseable sorts lowest. */
export function compareVersions(left, right) {
  const leftSegments = parseVersion(left) ?? [-1, -1, -1];
  const rightSegments = parseVersion(right) ?? [-1, -1, -1];
  for (let i = 0; i < 3; i++) {
    if (leftSegments[i] !== rightSegments[i]) {
      return leftSegments[i] < rightSegments[i] ? -1 : 1;
    }
  }
  return 0;
}

export function bumpVersion(version, bump) {
  const segments = parseVersion(version);
  if (!segments) {
    throw new Error(`Cannot bump version "${version}" — expected a stable X.Y.Z version.`);
  }
  const [major, minor, patch] = segments;
  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

export async function readVersion(target) {
  const contents = await readFile(path.join(ROOT, target.versionFile), 'utf8');
  return JSON.parse(contents).version;
}

/**
 * Rewrites only the top-level `version` value, leaving the rest of the file byte
 * for byte intact so the change never shows up as a reformat in the diff.
 */
export async function writeVersion(target, version) {
  const file = path.join(ROOT, target.versionFile);
  const contents = await readFile(file, 'utf8');
  const currentVersion = JSON.parse(contents).version;
  const versionField = new RegExp(`("version"\\s*:\\s*")${currentVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`);
  if (!versionField.test(contents)) {
    throw new Error(`Could not locate the version field in ${target.versionFile}`);
  }
  await writeFile(file, contents.replace(versionField, `$1${version}$2`));
}

/** Highest stable version already tagged for the application, or null if it has never been released. */
export async function latestReleasedVersion(target) {
  const { stdout } = await $`git tag --list ${target.tagPattern}`.quiet();
  const versions = stdout
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith(target.tagPrefix))
    .map((tag) => tag.slice(target.tagPrefix.length))
    .filter((version) => parseVersion(version));
  return versions.sort(compareVersions).at(-1) ?? null;
}

/**
 * The version the next release should bump from — whichever is higher between the
 * file on this branch and the highest existing tag.
 *
 * They diverge on hotfix branches: those are cut from `origin/release`, which tracks
 * the deployed *web* commit, so any extension or desktop release tagged from main
 * afterward leaves the corresponding file behind. Bumping the file directly would
 * publish a downgrade, so the tag wins.
 */
export async function resolveBaseVersion(target) {
  const fileVersion = await readVersion(target);
  const taggedVersion = await latestReleasedVersion(target);
  const isStale = !!taggedVersion && compareVersions(taggedVersion, fileVersion) > 0;
  return { fileVersion, taggedVersion, baseVersion: isStale ? taggedVersion : fileVersion, isStale };
}
