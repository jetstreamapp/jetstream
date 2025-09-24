import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ENV } from '@jetstream/api-config';
import { load } from 'js-yaml';
import { z } from 'zod';

interface VersionInfo {
  version: string;
  filename: string;
  sha512: string;
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
    platform: z.enum(['windows']),
    arch: z.enum(['x64']),
  }),
  z.object({
    platform: z.enum(['macos']),
    arch: z.enum(['x64', 'arm64']),
  }),
]);
export type PlatformArch = z.infer<typeof PlatformArchSchema>;

function getDownloadUrl(filename: string) {
  return `https://releases.getjetstream.app/${ASSET_FOLDER}/${filename}`;
}

async function getAndParseVersionFile(s3Client: S3Client, key: string) {
  return s3Client
    .send(
      new GetObjectCommand({
        Bucket: ENV.BACKBLAZE_BUCKET_NAME,
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

  if (!ENV.BACKBLAZE_ACCESS_KEY_ID || !ENV.BACKBLAZE_SECRET_ACCESS_KEY) {
    throw new Error('BackBlaze credentials are not set in environment variables');
  }

  const s3Client = new S3Client({
    endpoint: `https://s3.${ENV.BACKBLAZE_REGION}.backblazeb2.com`,
    region: ENV.BACKBLAZE_REGION,
    credentials: {
      accessKeyId: ENV.BACKBLAZE_ACCESS_KEY_ID,
      secretAccessKey: ENV.BACKBLAZE_SECRET_ACCESS_KEY,
    },
  });

  try {
    const [winRelease, macRelease] = await Promise.all([
      getAndParseVersionFile(s3Client, `${ASSET_FOLDER}/latest.yml`),
      getAndParseVersionFile(s3Client, `${ASSET_FOLDER}/latest-mac.yml`),
    ]);

    if (winRelease?.files.length) {
      const version = winRelease.version;
      const { sha512, url: filename } = winRelease?.files[0];
      versionCache.set('windows-x64', {
        data: { version, filename, sha512, link: getDownloadUrl(filename) },
        expiry: Date.now() + CACHE_DURATION_MS,
      });
    }

    if (macRelease?.files.length) {
      const arm64 = macRelease.files.find(({ url }) => url.endsWith('arm64.dmg'));
      const x64 = macRelease.files.find(({ url }) => url.endsWith('dmg') && !url.endsWith('arm64.dmg'));
      if (arm64) {
        const version = macRelease.version;
        const { sha512, url: filename } = arm64;
        versionCache.set('macos-arm64', {
          data: { version, filename, sha512, link: getDownloadUrl(filename) },
          expiry: Date.now() + CACHE_DURATION_MS,
        });
      }
      if (x64) {
        const version = macRelease.version;
        const { sha512, url: filename } = x64;
        versionCache.set('macos-x64', {
          data: { version, filename, sha512, link: getDownloadUrl(filename) },
          expiry: Date.now() + CACHE_DURATION_MS,
        });
      }
    }

    const cached = versionCache.get(cacheKey);
    if (!cached?.data) {
      throw new Error(`No version info found for ${platform}/${arch}`);
    }

    return cached.data;
  } catch (error) {
    console.error(`Failed to get latest version for ${platform}/${arch}:`, error);
    // Cache null result to avoid repeated failures
    versionCache.set(cacheKey, { data: null, expiry: Date.now() + CACHE_DURATION_MS });
    return null;
  }
}
