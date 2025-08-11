import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ENV } from '@jetstream/api-config';
import { z } from 'zod';
import { createRoute } from '../utils/route.utils';

const PlatformArchSchema = z.union([
  z.object({
    platform: z.enum(['windows']),
    arch: z.enum(['x64']),
  }),
  z.object({
    platform: z.enum(['macos']),
    arch: z.enum(['x64', 'arm64']),
  }),
]);
type PlatformArch = z.infer<typeof PlatformArchSchema>;

export const routeDefinition = {
  getDownloadLink: {
    controllerFn: () => getDownloadLink,
    validators: {
      params: PlatformArchSchema,
      hasSourceOrg: false,
    },
  },
  getAllDownloadLinks: {
    controllerFn: () => getAllDownloadLinks,
    validators: {
      hasSourceOrg: false,
    },
  },
};

interface VersionInfo {
  version: string;
  filename: string;
}

// Cache for version lookups (5 minutes)
const versionCache = new Map<string, { data: VersionInfo | null; expiry: number }>();

// Helper function to get latest version
async function getLatestVersion({ arch, platform }: PlatformArch): Promise<VersionInfo | null> {
  const cacheKey = `${platform}-${arch}`;
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
    let versionInfo: VersionInfo | null = null;

    if (platform === 'windows') {
      // Windows uses a RELEASES file with format: SHA1 filename size
      const releaseFile = await s3Client.send(
        new GetObjectCommand({
          Bucket: ENV.BACKBLAZE_BUCKET_NAME,
          Key: `jetstream/${platform}/${arch}/RELEASES`,
        })
      );

      if (releaseFile.Body) {
        const content = await releaseFile.Body.transformToString();
        const lines = content.trim().split('\n').filter(Boolean);

        if (lines.length > 0) {
          // Parse the last line (there should only be one line)
          const lastLine = lines[lines.length - 1];
          const [_sha, nupkgFilename] = lastLine.split(' ');

          // Extract version from nupkg filename (e.g., "Jetstream-0.1.0-full.nupkg" → "0.1.0")
          const versionMatch = nupkgFilename.match(/Jetstream-(\d+\.\d+\.\d+(?:-[\w.]+)?)-full\.nupkg/);
          const version = versionMatch ? versionMatch[1] : 'unknown';

          // The actual installer filename for Windows
          const filename = `Jetstream-${version}-Setup.exe`;

          versionInfo = {
            version,
            filename,
          };
        }
      }
    } else if (platform === 'macos') {
      // macOS uses RELEASES.json
      const releaseFile = await s3Client.send(
        new GetObjectCommand({
          Bucket: ENV.BACKBLAZE_BUCKET_NAME,
          Key: `jetstream/${platform}/${arch}/RELEASES.json`,
        })
      );

      if (releaseFile.Body) {
        const content = await releaseFile.Body.transformToString();
        const releasesData = JSON.parse(content);

        if (releasesData.currentRelease && releasesData.releases?.length > 0) {
          const currentRelease = releasesData.releases.find((r: any) => r.version === releasesData.currentRelease);

          if (currentRelease) {
            const version = currentRelease.version;
            // The DMG filename for macOS
            const filename = `Jetstream-${version}-${arch}.dmg`;

            versionInfo = {
              version,
              filename,
            };
          }
        }
      }
    }

    // Cache for 5 minutes
    versionCache.set(cacheKey, { data: versionInfo, expiry: Date.now() + 5 * 60 * 1000 });

    return versionInfo;
  } catch (error) {
    console.error(`Failed to get latest version for ${platform}/${arch}:`, error);
    // Cache null result to avoid repeated failures
    versionCache.set(cacheKey, { data: null, expiry: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}

const getDownloadLink = createRoute(routeDefinition.getDownloadLink.validators, async ({ params }, _req, res) => {
  try {
    const { arch, platform } = params;

    // Get latest version info from your S3 bucket
    const latestVersion = await getLatestVersion(params);

    if (!latestVersion) {
      res.status(404).json({ error: 'No download available for this platform/architecture' });
      return;
    }

    // Generate direct download URL using friendly subdomain
    const downloadUrl = `https://releases.getjetstream.app/jetstream/${platform}/${arch}/${latestVersion.filename}`;

    // Return download information
    res.json({
      version: latestVersion.version,
      filename: latestVersion.filename,
      downloadUrl,
    });
  } catch (error) {
    console.error('Download link generation failed:', error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

const getAllDownloadLinks = createRoute(routeDefinition.getAllDownloadLinks.validators, async (_, _req, res) => {
  try {
    // Define all platform/arch combinations we support
    const platformArchCombinations: PlatformArch[] = [
      { platform: 'windows', arch: 'x64' },
      { platform: 'macos', arch: 'x64' },
      { platform: 'macos', arch: 'arm64' },
    ];

    // Fetch all versions in parallel
    const versionPromises = platformArchCombinations.map(async (combo) => {
      const versionInfo = await getLatestVersion(combo);
      if (versionInfo) {
        return {
          platform: combo.platform,
          arch: combo.arch,
          version: versionInfo.version,
          filename: versionInfo.filename,
          downloadUrl: `https://releases.getjetstream.app/jetstream/${combo.platform}/${combo.arch}/${versionInfo.filename}`,
        };
      }
      return null;
    });

    const results = await Promise.all(versionPromises);
    const availableDownloads = results.filter((result) => result !== null);

    const downloads = {
      windows: availableDownloads.find(({ platform, arch }) => platform === 'windows' && arch === 'x64') || null,
      macosX64: availableDownloads.find(({ platform, arch }) => platform === 'macos' && arch === 'x64') || null,
      macosArm64: availableDownloads.find(({ platform, arch }) => platform === 'macos' && arch === 'arm64') || null,
    };

    res.json(downloads);
  } catch (error) {
    console.error('Failed to get all download links:', error);
    res.status(500).json({ error: 'Failed to get download links' });
  }
});
