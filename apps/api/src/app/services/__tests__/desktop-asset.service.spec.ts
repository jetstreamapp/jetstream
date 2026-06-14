import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestDesktopVersion } from '../desktop-asset.service';

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
