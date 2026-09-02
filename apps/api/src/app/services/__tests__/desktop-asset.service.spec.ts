import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestDesktopVersion, getPortableFilenameCandidates } from '../desktop-asset.service';

type S3Call = { kind: 'get' | 'head'; input: { Bucket: string; Key: string } };

const s3Mock = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    input: { Bucket: string; Key: string };
    constructor(input: { Bucket: string; Key: string }) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send = s3Mock.send;
    },
    GetObjectCommand: class extends Command {
      kind = 'get' as const;
    },
    HeadObjectCommand: class extends Command {
      kind = 'head' as const;
    },
  };
});

const apiConfigMock = vi.hoisted(() => ({
  ENV: {
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    AWS_ENDPOINT_URL: 'https://s3.example.com',
    AWS_REGION: 'auto',
    S3_BUCKET_NAME: 'bucket',
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => apiConfigMock);

describe('getLatestDesktopVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiConfigMock.ENV.AWS_ACCESS_KEY_ID = '';
    apiConfigMock.ENV.AWS_SECRET_ACCESS_KEY = '';
    apiConfigMock.ENV.AWS_ENDPOINT_URL = 'https://s3.example.com';
  });

  it('returns null instead of throwing when release storage credentials are unavailable', async () => {
    await expect(getLatestDesktopVersion({ platform: 'windows', arch: 'x64' })).resolves.toBeNull();

    expect(apiConfigMock.logger.warn).toHaveBeenCalledWith(
      'Object storage credentials are not set; desktop downloads are unavailable for windows/x64',
    );
  });

  it('returns null when the storage endpoint URL is not configured', async () => {
    apiConfigMock.ENV.AWS_ACCESS_KEY_ID = 'access-key';
    apiConfigMock.ENV.AWS_SECRET_ACCESS_KEY = 'secret-key';
    apiConfigMock.ENV.AWS_ENDPOINT_URL = '';

    // Use a distinct platform/arch so the cached null from the previous test does not short-circuit the credentials check
    await expect(getLatestDesktopVersion({ platform: 'macos', arch: 'arm64' })).resolves.toBeNull();

    expect(apiConfigMock.logger.warn).toHaveBeenCalledWith(
      'Object storage credentials are not set; desktop downloads are unavailable for macos/arm64',
    );
  });
});

describe('getPortableFilenameCandidates', () => {
  /**
   * The portable build is absent from latest.yml, so these names are the only way to find it. They
   * must stay in lockstep with `portable.artifactName` in electron-builder.config.js - a mismatch
   * silently hides the portable download rather than failing loudly.
   */
  it('offers the current hyphenated name before the pre-4.15 spaced name', () => {
    expect(getPortableFilenameCandidates('4.15.0')).toEqual(['Jetstream-Portable-4.15.0.exe', 'Jetstream 4.15.0.exe']);
  });

  it('still resolves the spaced name published for 4.14.0 and earlier', () => {
    expect(getPortableFilenameCandidates('4.14.0')).toContain('Jetstream 4.14.0.exe');
  });
});

/**
 * The portable build is discovered by HEAD-ing reconstructed filenames rather than read from
 * latest.yml, and a release without one is cached as a deliberate null. The module-level cache
 * means each case needs a fresh import.
 */
describe('getLatestDesktopVersion - portable Windows build', () => {
  const RELEASES = 'jetstream/releases';

  /** Stand in for the bucket: one latest.yml naming the installer, plus whichever portable files exist. */
  function mockBucket({ version, portableFiles }: { version: string; portableFiles: string[] }) {
    const latestYml = `version: ${version}\nfiles:\n  - url: Jetstream-Setup-${version}.exe\n    sha512: abc\nreleaseDate: '2026-09-05'\n`;
    const existingKeys = new Set(portableFiles.map((filename) => `${RELEASES}/${filename}`));
    s3Mock.send.mockImplementation(async (command: S3Call) => {
      if (command.kind === 'get') {
        return command.input.Key === `${RELEASES}/latest.yml` ? { Body: { transformToString: async () => latestYml } } : {};
      }
      if (!existingKeys.has(command.input.Key)) {
        throw new Error('NotFound');
      }
      return {};
    });
  }

  function headRequests() {
    return s3Mock.send.mock.calls
      .map(([command]) => command as S3Call)
      .filter(({ kind }) => kind === 'head')
      .map(({ input }) => input.Key);
  }

  async function loadService() {
    vi.resetModules();
    return import('../desktop-asset.service');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiConfigMock.ENV.AWS_ACCESS_KEY_ID = 'access-key';
    apiConfigMock.ENV.AWS_SECRET_ACCESS_KEY = 'secret-key';
    apiConfigMock.ENV.AWS_ENDPOINT_URL = 'https://s3.example.com';
  });

  it('offers the hyphenated name when the bucket has it', async () => {
    mockBucket({ version: '4.15.0', portableFiles: ['Jetstream-Portable-4.15.0.exe'] });
    const service = await loadService();

    await expect(service.getLatestDesktopVersion({ platform: 'windows-portable', arch: 'x64' })).resolves.toEqual({
      version: '4.15.0',
      filename: 'Jetstream-Portable-4.15.0.exe',
      link: `https://release-updates.getjetstream.app/${RELEASES}/Jetstream-Portable-4.15.0.exe`,
    });
    expect(headRequests()).toEqual([`${RELEASES}/Jetstream-Portable-4.15.0.exe`]);
  });

  it('falls back to the spaced name published before 4.15', async () => {
    mockBucket({ version: '4.14.0', portableFiles: ['Jetstream 4.14.0.exe'] });
    const service = await loadService();

    await expect(service.getLatestDesktopVersion({ platform: 'windows-portable', arch: 'x64' })).resolves.toMatchObject({
      filename: 'Jetstream 4.14.0.exe',
    });
    expect(headRequests()).toEqual([`${RELEASES}/Jetstream-Portable-4.14.0.exe`, `${RELEASES}/Jetstream 4.14.0.exe`]);
  });

  it('hides the download when no portable artifact was published, without treating it as a failure', async () => {
    mockBucket({ version: '4.13.0', portableFiles: [] });
    const service = await loadService();

    await expect(service.getLatestDesktopVersion({ platform: 'windows-portable', arch: 'x64' })).resolves.toBeNull();
    expect(apiConfigMock.logger.error).not.toHaveBeenCalled();

    // The null is a cached answer, so a second lookup must not go back to the bucket.
    const callsAfterFirstLookup = s3Mock.send.mock.calls.length;
    await expect(service.getLatestDesktopVersion({ platform: 'windows-portable', arch: 'x64' })).resolves.toBeNull();
    expect(s3Mock.send.mock.calls.length).toBe(callsAfterFirstLookup);
  });

  it('serves the installer from the same fetch that discovered the portable build', async () => {
    mockBucket({ version: '4.15.0', portableFiles: ['Jetstream-Portable-4.15.0.exe'] });
    const service = await loadService();
    await service.getLatestDesktopVersion({ platform: 'windows-portable', arch: 'x64' });
    const callsAfterFirstLookup = s3Mock.send.mock.calls.length;

    await expect(service.getLatestDesktopVersion({ platform: 'windows', arch: 'x64' })).resolves.toMatchObject({
      filename: 'Jetstream-Setup-4.15.0.exe',
    });
    expect(s3Mock.send.mock.calls.length).toBe(callsAfterFirstLookup);
  });
});
