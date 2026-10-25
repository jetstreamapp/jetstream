import { beforeEach, describe, expect, test, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: { getURL: vi.fn() },
  permissions: {
    contains: vi.fn(),
    request: vi.fn(),
    onRemoved: { addListener: vi.fn() },
  },
  storage: { local: { get: vi.fn(), set: vi.fn() } },
}));

vi.mock('webextension-polyfill', () => ({ default: browserMock }));
vi.mock('@jetstream/shared/client-logger', () => ({ logger: { log: vi.fn(), warn: vi.fn() } }));

import { registerSyncDataCollectionGuard, requestSyncDataCollectionConsent } from '../data-collection-consent';

const FIREFOX_URL = 'moz-extension://abc/';
const CHROME_URL = 'chrome-extension://abc/';

/** Lets the guard's un-awaited consent check finish */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  browserMock.storage.local.set.mockResolvedValue(undefined);
});

describe('requestSyncDataCollectionConsent', () => {
  test('does not ask outside Firefox', async () => {
    browserMock.runtime.getURL.mockReturnValue(CHROME_URL);
    await expect(requestSyncDataCollectionConsent()).resolves.toBe(true);
    expect(browserMock.permissions.request).not.toHaveBeenCalled();
  });

  test('asks Firefox for websiteContent consent and returns the answer', async () => {
    browserMock.runtime.getURL.mockReturnValue(FIREFOX_URL);
    browserMock.permissions.request.mockResolvedValue(false);
    await expect(requestSyncDataCollectionConsent()).resolves.toBe(false);
    expect(browserMock.permissions.request).toHaveBeenCalledWith({ data_collection: ['websiteContent'] });
  });

  test('treats a failed request as declined', async () => {
    browserMock.runtime.getURL.mockReturnValue(FIREFOX_URL);
    browserMock.permissions.request.mockRejectedValue(new Error('Not a user action'));
    await expect(requestSyncDataCollectionConsent()).resolves.toBe(false);
  });
});

describe('registerSyncDataCollectionGuard', () => {
  test('does nothing outside Firefox', () => {
    browserMock.runtime.getURL.mockReturnValue(CHROME_URL);
    registerSyncDataCollectionGuard();
    expect(browserMock.permissions.contains).not.toHaveBeenCalled();
    expect(browserMock.permissions.onRemoved.addListener).not.toHaveBeenCalled();
  });

  test('turns History Sync off when consent is missing, keeping the other options', async () => {
    browserMock.runtime.getURL.mockReturnValue(FIREFOX_URL);
    browserMock.permissions.contains.mockResolvedValue(false);
    browserMock.storage.local.get.mockResolvedValue({ options: { enabled: true, recordSyncEnabled: true, colorScheme: 'dark' } });

    registerSyncDataCollectionGuard();
    await flushPromises();

    expect(browserMock.storage.local.set).toHaveBeenCalledWith({
      options: { enabled: true, recordSyncEnabled: false, colorScheme: 'dark' },
    });
  });

  test('leaves History Sync on when consent is granted', async () => {
    browserMock.runtime.getURL.mockReturnValue(FIREFOX_URL);
    browserMock.permissions.contains.mockResolvedValue(true);

    registerSyncDataCollectionGuard();
    await flushPromises();

    expect(browserMock.storage.local.get).not.toHaveBeenCalled();
    expect(browserMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('re-checks when a permission is revoked', async () => {
    browserMock.runtime.getURL.mockReturnValue(FIREFOX_URL);
    browserMock.permissions.contains.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    browserMock.storage.local.get.mockResolvedValue({ options: { recordSyncEnabled: true } });

    registerSyncDataCollectionGuard();
    await flushPromises();
    expect(browserMock.storage.local.set).not.toHaveBeenCalled();

    const onRemoved = browserMock.permissions.onRemoved.addListener.mock.calls[0][0];
    onRemoved();
    await flushPromises();
    expect(browserMock.storage.local.set).toHaveBeenCalledWith({ options: { recordSyncEnabled: false } });
  });
});
