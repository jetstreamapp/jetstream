import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ENV, logger } from '@jetstream/api-config';
import { getErrorMessage } from '@jetstream/shared/utils';
import { load } from 'js-yaml';
import { z } from 'zod';

interface VersionInfo {
  version: string;
  filename: string;
  link: string;
}
interface VersionYaml {
  version: string;
  files: Array<{ url: string; sha512: string }>;
  releaseDate: string;
}

// Cache for version lookups (1 hour)
const ASSET_FOLDER = 'jetstream/releases';
const CACHE_DURATION_MS = 60 * 60 * 1000;
const versionCache = new Map<`${PlatformArch['platform']}-${PlatformArch['arch']}`, { data: VersionInfo | null; expiry: number }>();

export const PlatformArchSchema = z.union([
  z.object({
    platform: z.enum(['windows', 'windows-portable']),
    arch: z.enum(['x64']),
  }),
  z.object({
    platform: z.enum(['macos']),
    arch: z.enum(['x64', 'arm64']),
  }),
]);
export type PlatformArch = z.infer<typeof PlatformArchSchema>;

/**
 * electron-builder's portable target is not an update target, so it never appears in latest.yml -
 * the only published record of a release. Its filename is therefore reconstructed from the release
 * version instead, matching the `portable.artifactName` pinned in electron-builder.config.js, and
 * confirmed against the bucket before being offered (see `objectExists`).
 */
function getPortableFilename(version: string) {
  return `Jetstream ${version}.exe`;
}

function getDownloadUrl(filename: string) {
  // release-updates.getjetstream.app is the R2 custom domain the auto-updater uses (see
  // electron-builder.config.js publish config) and is the one known-working domain for the
  // desktop-updates bucket. releases.getjetstream.app was never wired up and served 404s.
  return `https://release-updates.getjetstream.app/${ASSET_FOLDER}/${filename}`;
}

/**
 * A reconstructed filename is a guess until proven otherwise - a release that predates the portable
 * target, or a renamed artifact, would otherwise hand users a 404. Any failure reads as "absent",
 * which just hides the download rather than breaking the page.
 */
async function objectExists(s3Client: S3Client, key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: ENV.S3_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function getAndParseVersionFile(s3Client: S3Client, key: string) {
  return s3Client
    .send(
      new GetObjectCommand({
        Bucket: ENV.S3_BUCKET_NAME,
        Key: key,
      }),
    )
    .then(({ Body }) => (Body ? Body.transformToString() : null))
    .then((content) => (content ? (load(content) as VersionYaml) : null));
}

// Helper function to get latest version
export async function getLatestDesktopVersion({ arch, platform }: PlatformArch): Promise<VersionInfo | null> {
  const cacheKey = `${platform}-${arch}` as const;
  const cached = versionCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  if (!ENV.AWS_ACCESS_KEY_ID || !ENV.AWS_SECRET_ACCESS_KEY || !ENV.AWS_ENDPOINT_URL) {
    logger.warn(`Object storage credentials are not set; desktop downloads are unavailable for ${platform}/${arch}`);
    versionCache.set(cacheKey, { data: null, expiry: Date.now() + CACHE_DURATION_MS });
    return null;
  }

  const s3Client = new S3Client({
    endpoint: ENV.AWS_ENDPOINT_URL,
    region: ENV.AWS_REGION,
    credentials: {
      accessKeyId: ENV.AWS_ACCESS_KEY_ID,
      secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const [winRelease, macRelease] = await Promise.all([
      getAndParseVersionFile(s3Client, `${ASSET_FOLDER}/latest.yml`),
      getAndParseVersionFile(s3Client, `${ASSET_FOLDER}/latest-mac.yml`),
    ]);

    if (winRelease?.files.length) {
      const version = winRelease.version;
      const { url: filename } = winRelease.files[0];
      versionCache.set('windows-x64', {
        data: { version, filename, link: getDownloadUrl(filename) },
        expiry: Date.now() + CACHE_DURATION_MS,
      });

      const portableFilename = getPortableFilename(version);
      const hasPortableBuild = await objectExists(s3Client, `${ASSET_FOLDER}/${portableFilename}`);
      versionCache.set('windows-portable-x64', {
        data: hasPortableBuild ? { version, filename: portableFilename, link: getDownloadUrl(portableFilename) } : null,
        expiry: Date.now() + CACHE_DURATION_MS,
      });
    }

    if (macRelease?.files.length) {
      const arm64 = macRelease.files.find(({ url }) => url.endsWith('arm64.dmg'));
      const x64 = macRelease.files.find(({ url }) => url.endsWith('.dmg') && !url.endsWith('arm64.dmg'));
      if (arm64) {
        const version = macRelease.version;
        const { url: filename } = arm64;
        versionCache.set('macos-arm64', {
          data: { version, filename, link: getDownloadUrl(filename) },
          expiry: Date.now() + CACHE_DURATION_MS,
        });
      }
      if (x64) {
        const version = macRelease.version;
        const { url: filename } = x64;
        versionCache.set('macos-x64', {
          data: { version, filename, link: getDownloadUrl(filename) },
          expiry: Date.now() + CACHE_DURATION_MS,
        });
      }
    }

    // An entry that was deliberately cached as null (a build this release does not publish) is a
    // normal answer, not a failure - only a key nothing populated at all means the lookup broke.
    const populated = versionCache.get(cacheKey);
    if (!populated) {
      throw new Error(`No version info found for ${platform}/${arch}`);
    }

    return populated.data;
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, `Failed to get latest version for ${platform}/${arch}`);
    // Cache null result to avoid repeated failures
    versionCache.set(cacheKey, { data: null, expiry: Date.now() + CACHE_DURATION_MS });
    return null;
  }
}
