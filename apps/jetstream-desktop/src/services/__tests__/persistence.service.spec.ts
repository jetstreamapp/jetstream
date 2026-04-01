import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * In-memory filesystem for controlled test scenarios.
 * Mocked fs and write-file-atomic operations read/write to this Map.
 */
const mockFs = new Map<string, Buffer>();

const TEST_USER_DATA = '/tmp/test-jetstream';
const APP_DATA_FILE = `${TEST_USER_DATA}/app-data.json`;
const SFDC_ORGS_FILE = `${TEST_USER_DATA}/orgs.json`;

// A valid 64-hex-char (32-byte) key for testing portable encryption
const TEST_HEX_KEY = 'ab'.repeat(32);

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => TEST_USER_DATA),
  },
  safeStorage: {
    encryptString: vi.fn((data: string) => Buffer.from(`SAFE${data}`)),
    decryptString: vi.fn((data: Buffer) => {
      const str = data.toString('utf8');
      if (str.startsWith('SAFE')) {
        return str.slice(4);
      }
      throw new Error('safeStorage: unable to decrypt');
    }),
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

describe('persistence.service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFs.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFs.clear();
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
    });

    it('creates a plain JSON file when file does not exist (no safeStorage)', async () => {
      const service = await importService();
      service.getAppData();

      // The file should exist now
      expect(mockFs.has(APP_DATA_FILE)).toBe(true);

      // The file should be valid plain JSON (not safeStorage binary)
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
    });

    it('falls back to safeStorage for legacy encrypted files', async () => {
      const appData = { deviceId: 'legacy-device', accessToken: 'legacy-token' };
      // Simulate a safeStorage-encrypted file (our mock prefixes with "SAFE")
      mockFs.set(APP_DATA_FILE, Buffer.from(`SAFE${JSON.stringify(appData)}`));

      const service = await importService();
      const result = service.getAppData();
      expect(result.deviceId).toBe('legacy-device');
      expect(result.accessToken).toBe('legacy-token');
    });

    it('starts fresh when file cannot be read by either method', async () => {
      // Write something that is neither valid JSON nor safeStorage-decodable
      mockFs.set(APP_DATA_FILE, Buffer.from([0x00, 0x01, 0x02, 0x03]));

      const service = await importService();
      const result = service.getAppData();
      // Should return default empty app data
      expect(result.accessToken).toBeUndefined();
    });
  });

  describe('setAppData', () => {
    it('writes plain JSON without safeStorage encryption', async () => {
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

    it('migrates legacy safeStorage file to plain JSON on write', async () => {
      // Start with a safeStorage file
      const legacyData = { deviceId: 'legacy-device', accessToken: 'legacy-token' };
      mockFs.set(APP_DATA_FILE, Buffer.from(`SAFE${JSON.stringify(legacyData)}`));

      const service = await importService();
      const appData = service.getAppData();
      expect(appData.deviceId).toBe('legacy-device');

      // Re-save — should write plain JSON
      service.setAppData(appData);

      const content = mockFs.get(APP_DATA_FILE)!.toString('utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      expect(JSON.parse(content).deviceId).toBe('legacy-device');

      // The file should NOT start with "SAFE" anymore
      expect(content.startsWith('SAFE')).toBe(false);
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

      // File should NOT be created (no safeStorage fallback)
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);
    });

    it('creates a portable-encrypted empty file when key is available and file does not exist', async () => {
      const service = await importService();
      service.setOrgEncryptionKey(TEST_HEX_KEY);

      service.getSalesforceOrgs();

      // File should exist and start with JSEK magic bytes
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(true);
      const data = mockFs.get(SFDC_ORGS_FILE)!;
      expect(data.subarray(0, 4).toString()).toBe('JSEK');
    });

    it('returns empty when file is portable but key is not yet set', async () => {
      // Create a portable-encrypted file using a temporary service instance
      const setup = await importService();
      setup.setOrgEncryptionKey(TEST_HEX_KEY);
      setup.createOrUpdateSalesforceOrg({
        uniqueId: 'org-1',
        accessToken: 'token',
        instanceUrl: 'https://test.salesforce.com',
        loginUrl: 'https://login.salesforce.com',
        userId: 'user-1',
        email: 'test@test.com',
        organizationId: 'org-id-1',
        username: 'test@test.com',
        displayName: 'Test User',
      });

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
      setup.setOrgEncryptionKey(TEST_HEX_KEY);
      setup.createOrUpdateSalesforceOrg({
        uniqueId: 'org-1',
        accessToken: 'token',
        instanceUrl: 'https://test.salesforce.com',
        loginUrl: 'https://login.salesforce.com',
        userId: 'user-1',
        email: 'test@test.com',
        organizationId: 'org-id-1',
        username: 'test@test.com',
        displayName: 'Test User',
      });

      // Fresh module — simulates restart
      vi.resetModules();
      const service = await importService();

      // Before key: empty
      expect(service.getSalesforceOrgs()).toEqual([]);

      // Set the same key
      service.setOrgEncryptionKey(TEST_HEX_KEY);

      // After key: data should be available
      const orgs = service.getSalesforceOrgs();
      expect(orgs).toHaveLength(1);
      expect(orgs[0].uniqueId).toBe('org-1');
    });
  });

  describe('org groups', () => {
    it('persists org groups through save/load cycle', async () => {
      const setup = await importService();
      setup.setOrgEncryptionKey(TEST_HEX_KEY);
      setup.createOrgGroup({ name: 'Production', description: 'Prod orgs' });
      setup.createOrgGroup({ name: 'Sandbox', description: null });

      // Fresh module — simulates restart
      vi.resetModules();
      const service = await importService();
      service.setOrgEncryptionKey(TEST_HEX_KEY);

      const groups = service.getOrgGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('Production');
      expect(groups[1].name).toBe('Sandbox');
    });

    it('returns empty groups before key is set (cold start)', async () => {
      // Create groups with key
      const setup = await importService();
      setup.setOrgEncryptionKey(TEST_HEX_KEY);
      setup.createOrgGroup({ name: 'My Group', description: null });

      // Fresh module — no key yet
      vi.resetModules();
      const service = await importService();

      expect(service.getOrgGroups()).toEqual([]);

      // After setting key, groups should appear
      service.setOrgEncryptionKey(TEST_HEX_KEY);
      expect(service.getOrgGroups()).toHaveLength(1);
      expect(service.getOrgGroups()[0].name).toBe('My Group');
    });
  });

  describe('saveOrgs guards', () => {
    it('refuses to save when key is unavailable but file is portable', async () => {
      const logger = await import('electron-log');

      const service = await importService();
      // Set key, create data, then clear key (simulates logout)
      service.setOrgEncryptionKey(TEST_HEX_KEY);
      service.createOrgGroup({ name: 'Test', description: null });

      // Capture the file after initial save
      const savedData = Buffer.from(mockFs.get(SFDC_ORGS_FILE)!);

      // Logout — clears key but ORG_FILE_IS_PORTABLE stays true
      service.clearOrgState();

      // Attempt a mutation after logout — this triggers readOrgs (returns empty,
      // no key) then saveOrgs which should refuse to write
      service.createOrgGroup({ name: 'Should Not Persist', description: null });

      // The file on disk should still have the original data (not overwritten)
      expect(mockFs.get(SFDC_ORGS_FILE)).toEqual(savedData);
      // The guard should have logged an error
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.stringContaining('portable format required but encryption key is unavailable'),
      );
    });
  });

  // ────────────────────────────────────────────────
  // VDI LIFECYCLE SCENARIOS
  // ────────────────────────────────────────────────

  describe('VDI scenarios', () => {
    it('orgs persist across simulated VM switches (same key)', async () => {
      // VM-A: Login, add org, add group
      const vmA = await importService();
      vmA.setOrgEncryptionKey(TEST_HEX_KEY);
      vmA.createOrgGroup({ name: 'Prod', description: null });
      const group = vmA.getOrgGroups()[0];
      vmA.createOrUpdateSalesforceOrg({
        uniqueId: 'org-1',
        accessToken: 'token-a',
        instanceUrl: 'https://test.salesforce.com',
        loginUrl: 'https://login.salesforce.com',
        userId: 'user-1',
        email: 'test@test.com',
        organizationId: 'org-id-1',
        username: 'test@test.com',
        displayName: 'Test User',
        jetstreamOrganizationId: group.id,
      });

      expect(vmA.getSalesforceOrgs()).toHaveLength(1);
      expect(vmA.getOrgGroups()).toHaveLength(1);

      // VM-B: Fresh start, same filesystem, same user key
      vi.resetModules();
      const vmB = await importService();

      // Before auth: empty
      expect(vmB.getSalesforceOrgs()).toEqual([]);
      expect(vmB.getOrgGroups()).toEqual([]);

      // After auth: data should be available
      vmB.setOrgEncryptionKey(TEST_HEX_KEY);
      expect(vmB.getSalesforceOrgs()).toHaveLength(1);
      expect(vmB.getSalesforceOrgs()[0].uniqueId).toBe('org-1');
      expect(vmB.getOrgGroups()).toHaveLength(1);
      expect(vmB.getOrgGroups()[0].name).toBe('Prod');
    });

    it('orgs persist after logout and re-login on same VM', async () => {
      const service = await importService();

      // Login and add data
      service.setOrgEncryptionKey(TEST_HEX_KEY);
      service.createOrUpdateSalesforceOrg({
        uniqueId: 'org-1',
        accessToken: 'token',
        instanceUrl: 'https://test.salesforce.com',
        loginUrl: 'https://login.salesforce.com',
        userId: 'user-1',
        email: 'test@test.com',
        organizationId: 'org-id-1',
        username: 'test@test.com',
        displayName: 'Test User',
      });
      service.createOrgGroup({ name: 'My Group', description: null });

      // Logout
      service.clearOrgState();

      // Re-login with same key
      service.setOrgEncryptionKey(TEST_HEX_KEY);

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
  // ENCRYPTION KEY VALIDATION
  // ────────────────────────────────────────────────

  describe('setOrgEncryptionKey', () => {
    it('accepts a valid 64-char hex key', async () => {
      const service = await importService();
      expect(() => service.setOrgEncryptionKey(TEST_HEX_KEY)).not.toThrow();
      expect(service.isOrgEncryptionKeyLoaded()).toBe(true);
    });

    it('rejects keys that are not 64 hex characters', async () => {
      const service = await importService();
      expect(() => service.setOrgEncryptionKey('tooshort')).toThrow(/expected 64 hex characters/);
      expect(() => service.setOrgEncryptionKey('zz'.repeat(32))).toThrow(/expected 64 hex characters/);
    });

    it('invalidates the in-memory cache', async () => {
      const service = await importService();
      service.setOrgEncryptionKey(TEST_HEX_KEY);

      // Create data so cache is populated
      service.createOrgGroup({ name: 'Cached', description: null });
      expect(service.getOrgGroups()).toHaveLength(1);

      // Re-setting the key should invalidate cache — next read comes from disk
      service.setOrgEncryptionKey(TEST_HEX_KEY);

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
      service.setOrgEncryptionKey(TEST_HEX_KEY);

      const orgs = service.getSalesforceOrgs();
      expect(orgs).toEqual([]);

      // Original file should be renamed (backed up), not deleted
      expect(mockFs.has(SFDC_ORGS_FILE)).toBe(false);
      const backupKeys = [...mockFs.keys()].filter((k) => k.includes('.corrupt-'));
      expect(backupKeys).toHaveLength(1);
    });
  });
});
