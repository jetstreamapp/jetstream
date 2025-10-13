import z from 'zod';
import { getLatestDesktopVersion, PlatformArch, PlatformArchSchema } from '../services/desktop-asset.service';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getDownloadLink: {
    controllerFn: () => getDownloadLink,
    responseType: z.object({
      version: z.string(),
      filename: z.string(),
      downloadUrl: z.string().url(),
    }),
    validators: {
      params: PlatformArchSchema,
      hasSourceOrg: false,
    },
  },
  getAllDownloadLinks: {
    controllerFn: () => getAllDownloadLinks,
    responseType: z.object({
      windows: z
        .object({
          platform: z.literal('windows'),
          arch: z.literal('x64'),
          version: z.string(),
          filename: z.string(),
          downloadUrl: z.string().url(),
        })
        .nullable(),
      macosX64: z
        .object({
          platform: z.literal('macos'),
          arch: z.literal('x64'),
          version: z.string(),
          filename: z.string(),
          downloadUrl: z.string().url(),
        })
        .nullable(),
      macosArm64: z
        .object({
          platform: z.literal('macos'),
          arch: z.literal('arm64'),
          version: z.string(),
          filename: z.string(),
          downloadUrl: z.string().url(),
        })
        .nullable(),
    }),
    validators: {
      hasSourceOrg: false,
    },
  },
};

const getDownloadLink = createRoute(routeDefinition.getDownloadLink.validators, async ({ params }, _req, res) => {
  try {
    const { arch, platform } = params;

    // Get latest version info from your S3 bucket
    const latestVersion = await getLatestDesktopVersion(params);

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
      const versionInfo = await getLatestDesktopVersion(combo);
      if (versionInfo) {
        return {
          platform: combo.platform,
          arch: combo.arch,
          version: versionInfo.version,
          filename: versionInfo.filename,
          downloadUrl: versionInfo.link,
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
