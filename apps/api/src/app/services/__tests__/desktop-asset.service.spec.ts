import { getLatestDesktopVersion, PlatformArchSchema } from '../desktop-asset.service';

// Need to clear the module cache to reset the versionCache between tests
let getLatestDesktopVersionFn: typeof getLatestDesktopVersion;

// Mock GetObjectCommand
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3Client: jest.fn(),
  };
});

jest.mock('@jetstream/api-config', () => ({
  ENV: {
    BACKBLAZE_ACCESS_KEY_ID: 'test-access-key',
    BACKBLAZE_SECRET_ACCESS_KEY: 'test-secret-key',
    BACKBLAZE_REGION: 'us-west-001',
    BACKBLAZE_BUCKET_NAME: 'test-bucket',
  },
}));

describe('desktop-asset.service', () => {
  let mockSend: jest.Mock;

  beforeEach(() => {
    // Clear all mocks and module cache to reset versionCache
    jest.clearAllMocks();
    jest.resetModules();
    jest.useFakeTimers();

    // Set up mocks before importing the module
    mockSend = jest.fn();

    // Re-mock after resetModules
    jest.doMock('@aws-sdk/client-s3', () => ({
      GetObjectCommand: jest.fn((input) => ({ input })),
      S3Client: jest.fn(() => ({
        send: mockSend,
      })),
    }));

    jest.doMock('@jetstream/api-config', () => ({
      ENV: {
        BACKBLAZE_ACCESS_KEY_ID: 'test-access-key',
        BACKBLAZE_SECRET_ACCESS_KEY: 'test-secret-key',
        BACKBLAZE_REGION: 'us-west-001',
        BACKBLAZE_BUCKET_NAME: 'test-bucket',
      },
    }));

    // Re-import the function after resetting modules to get a fresh versionCache
    const module = require('../desktop-asset.service');
    getLatestDesktopVersionFn = module.getLatestDesktopVersion;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  describe('PlatformArchSchema', () => {
    it('should validate windows x64', () => {
      const result = PlatformArchSchema.safeParse({ platform: 'windows', arch: 'x64' });
      expect(result.success).toBe(true);
    });

    it('should validate macos x64', () => {
      const result = PlatformArchSchema.safeParse({ platform: 'macos', arch: 'x64' });
      expect(result.success).toBe(true);
    });

    it('should validate macos arm64', () => {
      const result = PlatformArchSchema.safeParse({ platform: 'macos', arch: 'arm64' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid platform', () => {
      const result = PlatformArchSchema.safeParse({ platform: 'linux', arch: 'x64' });
      expect(result.success).toBe(false);
    });

    it('should reject windows arm64', () => {
      const result = PlatformArchSchema.safeParse({ platform: 'windows', arch: 'arm64' });
      expect(result.success).toBe(false);
    });
  });

  describe('getLatestDesktopVersion', () => {
    const macYamlContent = `version: 2.0.0
files:
  - url: Jetstream-2.0.0.dmg
    sha512: i/CiX/40zNzFG1a5bcP8kDKw8GNmUDnQSUWjETCjHKTHpvmglaU4Ga8AzdK/ZcDx13faVAQvR2r/6Z4r4getFQ==
    size: 329377568
  - url: Jetstream-2.0.0-arm64.dmg
    sha512: uOmD+b5gpSAWTObnS5l++qZ3smIiL19zQe/HcXWfrmvFkp/w64pPnsdmLzlwfSWgkvUylx+P6NXgYjuLGWY0dw==
    size: 320427808
path: Jetstream-2.0.0.dmg
sha512: i/CiX/40zNzFG1a5bcP8kDKw8GNmUDnQSUWjETCjHKTHpvmglaU4Ga8AzdK/ZcDx13faVAQvR2r/6Z4r4getFQ==
releaseDate: '2025-09-22T14:21:09.590Z'`;

    const windowsYamlContent = `version: 2.0.0
files:
  - url: Jetstream Setup 2.0.0.exe
    sha512: /67e908JVI8uZTg8pWjmCvJ/3mfwg3yTqquFSpzS8RtoRXDiYHDuKSwGipGQBcQkOVpRszmPrUnrFPVnM49faA==
    size: 96975128
path: Jetstream Setup 2.0.0.exe
sha512: /67e908JVI8uZTg8pWjmCvJ/3mfwg3yTqquFSpzS8RtoRXDiYHDuKSwGipGQBcQkOVpRszmPrUnrFPVnM49faA==
releaseDate: '2025-09-22T13:36:41.519Z'`;

    const createMockBody = (content: string) => ({
      transformToString: jest.fn().mockResolvedValue(content),
    });

    it('should fetch and return windows x64 version', async () => {
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) });

      const result = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });

      expect(result).toEqual({
        version: '2.0.0',
        filename: 'Jetstream Setup 2.0.0.exe',
        sha512: '/67e908JVI8uZTg8pWjmCvJ/3mfwg3yTqquFSpzS8RtoRXDiYHDuKSwGipGQBcQkOVpRszmPrUnrFPVnM49faA==',
        link: 'https://releases.getjetstream.app/jetstream/releases/Jetstream Setup 2.0.0.exe',
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      // Check that commands were sent with correct params
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'jetstream/releases/latest.yml',
          },
        }),
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'jetstream/releases/latest-mac.yml',
          },
        }),
      );
    });

    it('should fetch and return macos arm64 version', async () => {
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) });

      const result = await getLatestDesktopVersionFn({ platform: 'macos', arch: 'arm64' });

      expect(result).toEqual({
        version: '2.0.0',
        filename: 'Jetstream-2.0.0-arm64.dmg',
        sha512: 'uOmD+b5gpSAWTObnS5l++qZ3smIiL19zQe/HcXWfrmvFkp/w64pPnsdmLzlwfSWgkvUylx+P6NXgYjuLGWY0dw==',
        link: 'https://releases.getjetstream.app/jetstream/releases/Jetstream-2.0.0-arm64.dmg',
      });
    });

    it('should fetch and return macos x64 version', async () => {
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) });

      const result = await getLatestDesktopVersionFn({ platform: 'macos', arch: 'x64' });

      expect(result).toEqual({
        version: '2.0.0',
        filename: 'Jetstream-2.0.0.dmg',
        sha512: 'i/CiX/40zNzFG1a5bcP8kDKw8GNmUDnQSUWjETCjHKTHpvmglaU4Ga8AzdK/ZcDx13faVAQvR2r/6Z4r4getFQ==',
        link: 'https://releases.getjetstream.app/jetstream/releases/Jetstream-2.0.0.dmg',
      });
    });

    it('should use cached data on subsequent calls within cache duration', async () => {
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) });

      const result1 = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      const result2 = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });

      expect(result1).toEqual(result2);
      expect(mockSend).toHaveBeenCalledTimes(2); // Should only call once for initial fetch
    });

    it('should refetch after cache expiry', async () => {
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(macYamlContent) });

      await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });

      // Advance time beyond cache duration (1 hour + 1 second)
      jest.advanceTimersByTime(60 * 60 * 1000 + 1000);

      await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });

      expect(mockSend).toHaveBeenCalledTimes(4); // Two sets of fetches
    });

    it('should handle null Body response', async () => {
      mockSend.mockResolvedValueOnce({ Body: null }).mockResolvedValueOnce({ Body: null });

      const result = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });

      expect(result).toBeNull();
    });

    it('should handle S3 client errors and cache null result', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSend.mockRejectedValue(new Error('S3 error'));

      const result1 = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      expect(result1).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get latest version for windows/x64:', expect.any(Error));

      // Should return cached null without making another request
      const result2 = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      expect(result2).toBeNull();
      // mockSend was called twice (once for windows yaml, once for mac yaml) in the first call, but not in the second (cached)
      expect(mockSend).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });

    it('should throw error when BackBlaze credentials are not set', async () => {
      // Reset modules and re-mock with no credentials
      jest.resetModules();

      jest.doMock('@aws-sdk/client-s3', () => ({
        GetObjectCommand: jest.fn((input) => ({ input })),
        S3Client: jest.fn(() => ({
          send: mockSend,
        })),
      }));

      jest.doMock('@jetstream/api-config', () => ({
        ENV: {
          BACKBLAZE_ACCESS_KEY_ID: undefined,
          BACKBLAZE_SECRET_ACCESS_KEY: undefined,
          BACKBLAZE_REGION: 'us-west-001',
          BACKBLAZE_BUCKET_NAME: 'test-bucket',
        },
      }));

      // Re-import the function with the new mock
      const module = require('../desktop-asset.service');
      const getLatestDesktopVersionWithoutCreds = module.getLatestDesktopVersion;

      await expect(getLatestDesktopVersionWithoutCreds({ platform: 'windows', arch: 'x64' })).rejects.toThrow(
        'BackBlaze credentials are not set in environment variables',
      );
    });

    it('should handle empty files array in response', async () => {
      const emptyFilesYaml = `version: 2.0.0
files: []
releaseDate: '2025-09-22T13:36:41.519Z'`;

      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(emptyFilesYaml) })
        .mockResolvedValueOnce({ Body: createMockBody(emptyFilesYaml) });

      const result = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      expect(result).toBeNull();
    });

    it('should handle malformed YAML content', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody('invalid: yaml: content:') })
        .mockResolvedValueOnce({ Body: createMockBody('invalid: yaml: content:') });

      const result = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle platform/arch combination not found in response', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const macOnlyYaml = `version: 2.0.0
files:
  - url: Jetstream-2.0.0-arm64.dmg
    sha512: uOmD+b5gpSAWTObnS5l++qZ3smIiL19zQe/HcXWfrmvFkp/w64pPnsdmLzlwfSWgkvUylx+P6NXgYjuLGWY0dw==
    size: 320427808
releaseDate: '2025-09-22T14:21:09.590Z'`;

      mockSend.mockResolvedValueOnce({ Body: createMockBody('') }).mockResolvedValueOnce({ Body: createMockBody(macOnlyYaml) });

      const result = await getLatestDesktopVersionFn({ platform: 'windows', arch: 'x64' });
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to get latest version for windows/x64:',
        expect.objectContaining({
          message: 'No version info found for windows/x64',
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should correctly identify arm64 DMG files by suffix', async () => {
      const mixedMacYaml = `version: 2.0.0
files:
  - url: Jetstream-2.0.0-universal.dmg
    sha512: universal-sha512
    size: 400000000
  - url: Jetstream-2.0.0-arm64.dmg
    sha512: arm64-sha512
    size: 320427808
  - url: Jetstream-2.0.0-intel.dmg
    sha512: intel-sha512
    size: 329377568
releaseDate: '2025-09-22T14:21:09.590Z'`;

      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(mixedMacYaml) });

      const armResult = await getLatestDesktopVersionFn({ platform: 'macos', arch: 'arm64' });
      expect(armResult?.filename).toBe('Jetstream-2.0.0-arm64.dmg');
      expect(armResult?.sha512).toBe('arm64-sha512');

      // Clear cache to test x64
      jest.advanceTimersByTime(60 * 60 * 1000 + 1000);
      mockSend
        .mockResolvedValueOnce({ Body: createMockBody(windowsYamlContent) })
        .mockResolvedValueOnce({ Body: createMockBody(mixedMacYaml) });

      const x64Result = await getLatestDesktopVersionFn({ platform: 'macos', arch: 'x64' });
      expect(x64Result?.filename).toBe('Jetstream-2.0.0-universal.dmg');
      expect(x64Result?.sha512).toBe('universal-sha512');
    });
  });
});
