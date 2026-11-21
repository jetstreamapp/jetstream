import { UserProfileUiSchema } from '@jetstream/types';
import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * In-memory filesystem for controlled test scenarios.
 * Mocked fs and write-file-atomic operations read/write to this Map.
 */
const mockFs = new Map<string, Buffer>();

/** Modes applied via the mocked chmodSync, so tests can assert permissions were tightened */
const mockFileModes = new Map<string, number>();

const TEST_USER_DATA = '/tmp/test-jetstream';
const APP_DATA_FILE = `${TEST_USER_DATA}/app-data.json`;
/** Pre-user-scoping shared file that existing installs still have on disk */

/** Mirrors getOrgsFilePathForUser in the service under test */
function orgsFileFor(userId: string) {
  return `${TEST_USER_DATA}/orgs-${createHash('sha256').update(userId).digest('hex').slice(0, 32)}.json`;
}

// Valid 64-hex-char (32-byte) keys for testing portable encryption. The real keys are
// HMAC(serverSecret, userId), so a different user always means a different key.
const TEST_HEX_KEY = 'ab'.repeat(32);
const USER_A = { userId: 'user-a', encryptionKey: 'ab'.repeat(32) };
const USER_B = { userId: 'user-b', encryptionKey: 'cd'.repeat(32) };
const SFDC_ORGS_FILE = orgsFileFor(USER_A.userId);

/** Minimal valid org payload for tests that need to create data */
function testOrg(overrides: Record<string, unknown> = {}) {
  return {
    uniqueId: 'org-1',
    accessToken: 'token',
    instanceUrl: 'https://test.salesforce.com',
    loginUrl: 'https://login.salesforce.com',
    userId: 'user-1',
    email: 'test@test.com',
    organizationId: 'org-id-1',
    username: 'test@test.com',
    displayName: 'Test User',
    ...overrides,
  };
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => TEST_USER_DATA),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const mocked = {
    ...actual,
    existsSync: vi.fn((path: string) => mockFs.has(path)),
    readFileSync: vi.fn((path: string, encoding?: BufferEncoding) => {
      if (!mockFs.has(path)) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' });
      }
      const data = mockFs.get(path)!;
      if (encoding === 'utf8') {
        return data.toString('utf8');
      }
      return data;
    }),
    writeFileSync: vi.fn((path: string, data: Buffer | Uint8Array | string) => {
      if (Buffer.isBuffer(data)) {
        mockFs.set(path, data);
      } else if (data instanceof Uint8Array) {
        mockFs.set(path, Buffer.from(data));
      } else {
        mockFs.set(path, Buffer.from(data, 'utf8'));
      }
    }),
    renameSync: vi.fn((from: string, to: string) => {
      const data = mockFs.get(from);
      if (data) {
        mockFs.set(to, data);
        mockFs.delete(from);
      }
    }),
    unlinkSync: vi.fn((path: string) => {
      mockFs.delete(path);
    }),
    chmodSync: vi.fn((path: string, mode: number) => {
      if (!mockFs.has(path)) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, chmod '${path}'`), { code: 'ENOENT' });
      }
      mockFileModes.set(path, mode);
    }),
  };
  return { ...mocked, default: mocked };
});

vi.mock('write-file-atomic', () => ({
  default: {
    sync: vi.fn((path: string, data: Buffer | string) => {
      if (Buffer.isBuffer(data)) {
        mockFs.set(path, data);
      } else {
        mockFs.set(path, Buffer.from(data, 'utf8'));
      }
    }),
  },
}));

// Dynamic import helper — each call gets a fresh module with clean state
async function importService() {
  return import('../persistence.service');
}

// The first test in this file pays the cost of compiling and resolving the
// persistence service and its transitive deps (crypto, electron mocks,
// write-file-atomic, jwt-decode). On slower CI runners that cold start can
// exceed the 5s default — bump the timeout so the first test has headroom.
vi.setConfig({ testTimeout: 30_000 });

describe('persistence.service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFs.clear();
    mockFileModes.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFs.clear();
    mockFileModes.clear();
  });

  // ────────────────────────────────────────────────
  // APP DATA (auth state persistence)
  // ────────────────────────────────────────────────

  describe('getAppData', () => {
    it('returns empty app data when file does not exist', async () => {
      const service = await importService();
      const result = service.getAppData();
      expect(result.accessToken).toBeUndefined();
      expect(result.deviceId).toBeDefined(); // schema default generates a deviceId
      expect(service.isFreshProfile()).toBe(true);
    });

    it('creates a plain JSON file when file does not exist', async () => {
      const service = await importService();
      service.getAppData();

      // The file should exist now
      expect(mockFs.has(APP_DATA_FILE)).toBe(true);

      // The file should be valid plain JSON
      const content = mockFs.get(APP_DATA_FILE)!.toString('utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('reads plain JSON app-data file (new format)', async () => {
      const appData = { deviceId: 'test-device', accessToken: 'test-jwt-token' };
      mockFs.set(APP_DATA_FILE, Buffer.from(JSON.stringify(appData)));

      const service = await importService();
      const result = service.getAppData();
      expect(result.deviceId).toBe('test-device');
      expect(result.accessToken).toBe('test-jwt-token');
      // A returning user must not report a fresh profile - that signal is how a userData
      // directory that is not persisting (roaming/VDI) is told apart from genuine new devices
      expect(service.isFreshProfile()).toBe(false);
    });

    it('starts fresh when the file is not valid JSON', async () => {
      mockFs.set(APP_DATA_FILE, Buffer.from([0x00, 0x01, 0x02, 0x03]));

      const service = await importService();
      const result = service.getAppData();
      // Should return default empty app data
      expect(result.accessToken).toBeUndefined();
      expect(service.isFreshProfile()).toBe(true);
    });
  });

  describe('setAppData', () => {
    it('writes plain JSON', async () => {
      const service = await importService();
      service.getAppData(); // initialize

      service.setAppData({
        deviceId: 'new-device',
        accessToken: 'new-token',
      } as Parameters<typeof service.setAppData>[0]);

      const content = mockFs.get(APP_DATA_FILE)!.toString('utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      expect(parsed.deviceId).toBe('new-device');
      expect(parsed.accessToken).toBe('new-token');
    });
  });

  // ────────────────────────────────────────────────
  // USER PROFILE
  // ────────────────────────────────────────────────

  describe('getFullUserProfile', () => {
    it('passes through server-provided feature flags and signature', async () => {
      const service = await importService();
      service.setAppData({
        deviceId: 'device-1',
        accessToken: 'jwt-token-123',
        userProfile: UserProfileUiSchema.parse({
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          featureFlags: { 'analysis-tools': true },
          featureFlagsSignature: 'signature-abc',
        }),
      });

      const userProfile = service.getFullUserProfile();
      expect(userProfile.featureFlags).toEqual({ 'analysis-tools': true });
      expect(userProfile.featureFlagsSignature).toBe('signature-abc');
    });

    it('surfaces no signature when the stored profile predates feature flag delivery', async () => {
      const service = await importService();
      service.setAppData({
        deviceId: 'device-1',
        accessToken: 'jwt-token-123',
        userProfile: UserProfileUiSchema.parse({
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      const userProfile = service.getFullUserProfile();
      // No signature means the renderer's verification fail-closes to code defaults
      expect(userProfile.featureFlags).toEqual({});
      expect(userProfile.featureFlagsSignature).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────
  // USER PREFERENCES
  // ────────────────────────────────────────────────

  describe('updateUserPreferencesFromRenderer', () => {
    it('ignores a renderer-supplied data history folder and download path, keeping the stored values', async () => {
      const service = await importService();
      service.updateUserPreferences({ dataHistoryFolder: '/Users/me/jetstream-history' });
      service.setDownloadFolderPath('/Users/me/Downloads/jetstream');

      const updated = service.updateUserPreferencesFromRenderer({
        skipFrontdoorLogin: true,
        dataHistoryFolder: '/Users/victim/.ssh',
        fileDownload: { omitPrompt: true, downloadPath: '/Users/victim/Library/LaunchAgents' },
      });

      expect(updated.skipFrontdoorLogin).toBe(true);
      expect(updated.dataHistoryFolder).toBe('/Users/me/jetstream-history');
      expect(updated.fileDownload).toEqual({ omitPrompt: true, downloadPath: '/Users/me/Downloads/jetstream' });
    });

    it('lets the renderer clear the download path, which only turns the save prompt back on', async () => {
      const service = await importService();
      service.setDownloadFolderPath('/Users/me/Downloads/jetstream');

      const updated = service.updateUserPreferencesFromRenderer({ fileDownload: { omitPrompt: false, downloadPath: '' } });

      expect(updated.fileDownload).toEqual({ omitPrompt: false, downloadPath: '' });
    });

    it('cannot set a download path when none is stored', async () => {
      const service = await importService();

      const updated = service.updateUserPreferencesFromRenderer({ fileDownload: { omitPrompt: true, downloadPath: '/tmp/anywhere' } });

      expect(updated.fileDownload).toEqual({ omitPrompt: true, downloadPath: '' });
    });

    it('saves updates without folder preferences unchanged', async () => {
      const service = await importService();
      expect(service.updateUserPreferencesFromRenderer({ recordSyncEnabled: true }).recordSyncEnabled).toBe(true);
    });
  });

  describe('setDownloadFolderPath', () => {
    it('stores the folder and turns auto-save on', async () => {
      const service = await importService();
      service.updateUserPreferences({ fileDownload: { omitPrompt: false, downloadPath: '' } });

      const updated = service.setDownloadFolderPath('/Users/me/Downloads/jetstream');

      expect(updated.fileDownload).toEqual({ omitPrompt: true, downloadPath: '/Users/me/Downloads/jetstream' });
      expect(service.getUserPreferences().fileDownload?.downloadPath).toBe('/Users/me/Downloads/jetstream');
    });
  });

  // ────────────────────────────────────────────────
  // ORG DATA
  // ────────────────────────────────────────────────

  describe('readOrgs / getOrgGroups / getSalesforceOrgs', () => {
    it('returns empty when file does not exist and no encryption key', async () => {
      const service = await importService();

      const orgs = service.getSalesforceOrgs();
      const groups = service.getOrgGroups();

      expect(orgs).toEqual([]);
      expect(groups).toEqual([]);
    });

    it('does NOT create a file when no encryption key is available', async () => {
      const service = await importService();
      service.getSalesforceOrgs();

      // File should NOT be created
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);
    });

    it('does not write a file until there is something to save', async () => {
      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      expect(service.getSalesforceOrgs()).toEqual([]);
      // Reading alone must not create the file — its absence is what tells the next read that
      // legacy adoption has not happened yet (see "legacy orgs file migration")
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);

      // The file appears, portable-encrypted, on the first real write
      service.createOrgGroup({ name: 'First', description: null });
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(true);
      expect(mockFs.get(SFDC_ORGS_FILE)!.subarray(0, 4).toString()).toBe('JSEK');
    });

    it('returns empty when file is portable but key is not yet set', async () => {
      // Create a portable-encrypted file using a temporary service instance
      const setup = await importService();
      setup.bindOrgStorageToUser(USER_A);
      setup.createOrUpdateSalesforceOrg(testOrg());

      // Confirm the file exists on "disk"
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(true);

      // Fresh module — no key set yet (simulates cold start before auth)
      vi.resetModules();
      const service = await importService();

      const orgs = service.getSalesforceOrgs();
      expect(orgs).toEqual([]);

      // File should still be untouched (not overwritten or deleted)
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(true);
    });

    it('decrypts and returns orgs after key is set', async () => {
      // Create a portable-encrypted file with data
      const setup = await importService();
      setup.bindOrgStorageToUser(USER_A);
      setup.createOrUpdateSalesforceOrg(testOrg());

      // Fresh module — simulates restart
      vi.resetModules();
      const service = await importService();

      // Before key: empty
      expect(service.getSalesforceOrgs()).toEqual([]);

      // Set the same key
      service.bindOrgStorageToUser(USER_A);

      // After key: data should be available
      const orgs = service.getSalesforceOrgs();
      expect(orgs).toHaveLength(1);
      expect(orgs[0].uniqueId).toBe('org-1');
    });
  });

  describe('org groups', () => {
    it('persists org groups through save/load cycle', async () => {
      const setup = await importService();
      setup.bindOrgStorageToUser(USER_A);
      setup.createOrgGroup({ name: 'Production', description: 'Prod orgs' });
      setup.createOrgGroup({ name: 'Sandbox', description: null });

      // Fresh module — simulates restart
      vi.resetModules();
      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      const groups = service.getOrgGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('Production');
      expect(groups[1].name).toBe('Sandbox');
    });

    it('returns empty groups before key is set (cold start)', async () => {
      // Create groups with key
      const setup = await importService();
      setup.bindOrgStorageToUser(USER_A);
      setup.createOrgGroup({ name: 'My Group', description: null });

      // Fresh module — no key yet
      vi.resetModules();
      const service = await importService();

      expect(service.getOrgGroups()).toEqual([]);

      // After setting key, groups should appear
      service.bindOrgStorageToUser(USER_A);
      expect(service.getOrgGroups()).toHaveLength(1);
      expect(service.getOrgGroups()[0].name).toBe('My Group');
    });
  });

  describe('saveOrgs guards', () => {
    it('refuses to save after logout, when there is no signed-in user to attribute the write to', async () => {
      const logger = await import('electron-log');

      const service = await importService();
      // Set key, create data, then clear key (simulates logout)
      service.bindOrgStorageToUser(USER_A);
      service.createOrgGroup({ name: 'Test', description: null });

      // Capture the file after initial save
      const savedData = Buffer.from(mockFs.get(SFDC_ORGS_FILE)!);

      service.clearOrgState();

      // Attempt a mutation after logout — this triggers readOrgs (returns empty,
      // no key) then saveOrgs, which must throw rather than report a success the
      // caller would surface to the user for a change that was never written.
      expect(() => service.createOrgGroup({ name: 'Should Not Persist', description: null })).toThrow(/not bound to a signed-in user/);

      // The file on disk should still have the original data (not overwritten)
      expect(mockFs.get(SFDC_ORGS_FILE)).toEqual(savedData);
      // The guard should have logged an error
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining('org storage is not bound to a user'));
    });

    it('surfaces a failed write instead of reporting success on data that never reached disk', async () => {
      const writeFileAtomic = (await import('write-file-atomic')).default;
      const { writeFileSync } = await import('fs');

      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      // Both the atomic write and the non-atomic fallback fail — e.g. a full or read-only disk
      vi.mocked(writeFileAtomic.sync).mockImplementationOnce(() => {
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      });
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      });

      expect(() => service.createOrgGroup({ name: 'Should Not Persist', description: null })).toThrow(/ENOSPC/);
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────
  // MULTI-ACCOUNT ISOLATION
  // ────────────────────────────────────────────────

  describe('multi-account isolation', () => {
    it('keeps each account orgs in its own file', async () => {
      const service = await importService();

      service.bindOrgStorageToUser(USER_A);
      service.createOrUpdateSalesforceOrg(testOrg({ uniqueId: 'org-a' }));
      service.createOrgGroup({ name: 'A Group', description: null });

      service.clearOrgState();
      service.bindOrgStorageToUser(USER_B);
      service.createOrUpdateSalesforceOrg(testOrg({ uniqueId: 'org-b' }));

      expect(service.getSalesforceOrgs()).toHaveLength(1);
      expect(service.getSalesforceOrgs()[0].uniqueId).toBe('org-b');
      expect(service.getOrgGroups()).toEqual([]);

      // Both files coexist
      expect(mockFs.has(orgsFileFor(USER_A.userId))).toBe(true);
      expect(mockFs.has(orgsFileFor(USER_B.userId))).toBe(true);
    });

    it('does not destroy the other account data when switching users', async () => {
      const service = await importService();

      service.bindOrgStorageToUser(USER_A);
      service.createOrUpdateSalesforceOrg(testOrg({ uniqueId: 'org-a' }));
      const userAFile = Buffer.from(mockFs.get(orgsFileFor(USER_A.userId))!);

      // Sign in as a different account, then back again
      service.clearOrgState();
      service.bindOrgStorageToUser(USER_B);
      service.createOrUpdateSalesforceOrg(testOrg({ uniqueId: 'org-b' }));
      service.clearOrgState();
      service.bindOrgStorageToUser(USER_A);

      // User A's file was never touched and their orgs are still readable
      expect(mockFs.get(orgsFileFor(USER_A.userId))).toEqual(userAFile);
      expect(service.getSalesforceOrgs()).toHaveLength(1);
      expect(service.getSalesforceOrgs()[0].uniqueId).toBe('org-a');
      // Nothing was quarantined as corrupt
      expect([...mockFs.keys()].filter((key) => key.includes('.corrupt-'))).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────
  // VDI LIFECYCLE SCENARIOS
  // ────────────────────────────────────────────────

  describe('VDI scenarios', () => {
    it('orgs persist across simulated VM switches (same key)', async () => {
      // VM-A: Login, add org, add group
      const vmA = await importService();
      vmA.bindOrgStorageToUser(USER_A);
      vmA.createOrgGroup({ name: 'Prod', description: null });
      const group = vmA.getOrgGroups()[0];
      vmA.createOrUpdateSalesforceOrg(testOrg({ accessToken: 'token-a', jetstreamOrganizationId: group.id }));

      expect(vmA.getSalesforceOrgs()).toHaveLength(1);
      expect(vmA.getOrgGroups()).toHaveLength(1);

      // VM-B: Fresh start, same filesystem, same user key
      vi.resetModules();
      const vmB = await importService();

      // Before auth: empty
      expect(vmB.getSalesforceOrgs()).toEqual([]);
      expect(vmB.getOrgGroups()).toEqual([]);

      // After auth: data should be available
      vmB.bindOrgStorageToUser(USER_A);
      expect(vmB.getSalesforceOrgs()).toHaveLength(1);
      expect(vmB.getSalesforceOrgs()[0].uniqueId).toBe('org-1');
      expect(vmB.getOrgGroups()).toHaveLength(1);
      expect(vmB.getOrgGroups()[0].name).toBe('Prod');
    });

    it('orgs persist after logout and re-login on same VM', async () => {
      const service = await importService();

      // Login and add data
      service.bindOrgStorageToUser(USER_A);
      service.createOrUpdateSalesforceOrg(testOrg());
      service.createOrgGroup({ name: 'My Group', description: null });

      // Logout
      service.clearOrgState();

      // Re-login with same key
      service.bindOrgStorageToUser(USER_A);

      // Data should be readable from disk
      expect(service.getSalesforceOrgs()).toHaveLength(1);
      expect(service.getOrgGroups()).toHaveLength(1);
    });

    it('app-data auth state persists across VM switches (plain JSON)', async () => {
      // VM-A: Save auth data
      const vmA = await importService();
      vmA.setAppData({
        deviceId: 'device-1',
        accessToken: 'jwt-token-123',
      } as Parameters<typeof vmA.setAppData>[0]);

      // VM-B: Fresh start, same filesystem
      vi.resetModules();
      const vmB = await importService();

      const appData = vmB.getAppData();
      expect(appData.deviceId).toBe('device-1');
      expect(appData.accessToken).toBe('jwt-token-123');
    });
  });

  // ────────────────────────────────────────────────
  // ORG STORAGE BINDING
  // ────────────────────────────────────────────────

  describe('bindOrgStorageToUser', () => {
    it('accepts a valid 64-char hex key', async () => {
      const service = await importService();
      expect(() => service.bindOrgStorageToUser(USER_A)).not.toThrow();
      expect(service.isOrgStorageBound()).toBe(true);
    });

    it('rejects keys that are not 64 hex characters', async () => {
      const service = await importService();
      expect(() => service.bindOrgStorageToUser({ userId: 'user-a', encryptionKey: 'tooshort' })).toThrow(
        /encryption key must be 64 hex characters/,
      );
      expect(() => service.bindOrgStorageToUser({ userId: 'user-a', encryptionKey: 'zz'.repeat(32) })).toThrow(
        /encryption key must be 64 hex characters/,
      );
    });

    it('rejects a missing userId, which would leave org storage unscoped', async () => {
      const service = await importService();
      expect(() => service.bindOrgStorageToUser({ userId: '', encryptionKey: TEST_HEX_KEY })).toThrow(/userId is required/);
      expect(service.isOrgStorageBound()).toBe(false);
    });

    it('invalidates the in-memory cache', async () => {
      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      // Create data so cache is populated
      service.createOrgGroup({ name: 'Cached', description: null });
      expect(service.getOrgGroups()).toHaveLength(1);

      // Re-setting the key should invalidate cache — next read comes from disk
      service.bindOrgStorageToUser(USER_A);

      // Should still work (re-reads from disk)
      expect(service.getOrgGroups()).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────
  // PORTABLE DECRYPTION FAILURE
  // ────────────────────────────────────────────────

  describe('portable decryption failure', () => {
    it('backs up corrupt file and returns empty', async () => {
      // Write a file with JSEK magic but garbage payload
      const corruptData = Buffer.concat([Buffer.from('JSEK'), Buffer.alloc(64, 0xff)]);
      mockFs.set(SFDC_ORGS_FILE, corruptData);

      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      const orgs = service.getSalesforceOrgs();
      expect(orgs).toEqual([]);

      // Original file should be renamed (backed up), not deleted
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);
      const backupKeys = [...mockFs.keys()].filter((k) => k.includes('.corrupt-'));
      expect(backupKeys).toHaveLength(1);
    });
  });

  describe('token encryption', () => {
    it('round-trips a token with the signed-in user key', async () => {
      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      const encrypted = service.encryptTokenPortable('access refresh');

      expect(encrypted.startsWith('jsek:')).toBe(true);
      expect(service.decryptTokenPortable(encrypted)).toBe('access refresh');
    });

    it('refuses to encrypt without a user key instead of using a machine-bound fallback', async () => {
      const service = await importService();

      expect(() => service.encryptTokenPortable('access refresh')).toThrow('Portable encryption key not available');
    });

    it('rejects tokens that are not in the portable format so the org can be re-authorized', async () => {
      const service = await importService();
      service.bindOrgStorageToUser(USER_A);

      expect(() => service.decryptTokenPortable(Buffer.from('legacy-safe-storage-token').toString('base64'))).toThrow('re-authorized');
    });
  });
});
