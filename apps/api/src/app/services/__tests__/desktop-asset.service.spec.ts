import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestDesktopVersion } from '../desktop-asset.service';

const apiConfigMock = vi.hoisted(() => ({
  ENV: {
    BACKBLAZE_ACCESS_KEY_ID: '',
    BACKBLAZE_BUCKET_NAME: 'bucket',
    BACKBLAZE_REGION: 'us-west-001',
    BACKBLAZE_SECRET_ACCESS_KEY: '',
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
    apiConfigMock.ENV.BACKBLAZE_ACCESS_KEY_ID = '';
    apiConfigMock.ENV.BACKBLAZE_SECRET_ACCESS_KEY = '';
  });

  it('returns null instead of throwing when release storage credentials are unavailable', async () => {
    await expect(getLatestDesktopVersion({ platform: 'windows', arch: 'x64' })).resolves.toBeNull();

    expect(apiConfigMock.logger.warn).toHaveBeenCalledWith(
      'BackBlaze credentials are not set; desktop downloads are unavailable for windows/x64',
    );
  });
});
