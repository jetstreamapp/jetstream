import { OrgsWithGroupResponse } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_ORG_SYNC_CONNECTION_ERR_MESSAGE } from '../persistence.service';

// Mock electron modules before any imports
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockWriteFileAtomicSync = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: () => '/mock/userData',
  },
  safeStorage: {
    encryptString: (str: string) => Buffer.from(`encrypted:${str}`),
    decryptString: (buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith('encrypted:') ? str.slice('encrypted:'.length) : str;
    },
  },
}));

vi.mock('electron-log', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const mocked = {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  };
  return { ...mocked, default: mocked };
});

vi.mock('write-file-atomic', () => ({
  default: {
    sync: (...args: unknown[]) => mockWriteFileAtomicSync(...args),
  },
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn().mockReturnValue({ exp: 1700000000 }),
}));

// Helper to build a valid SalesforceOrgServer-shaped object
function buildSalesforceOrg(overrides: Record<string, unknown> = {}) {
  return {
    uniqueId: 'org-1',
    filterText: 'test@example.comTestOrgtest-label',
    accessToken: 'token-123',
    instanceUrl: 'https://test.salesforce.com',
    loginUrl: 'https://login.salesforce.com',
    userId: 'user-1',
    email: 'test@example.com',
    organizationId: 'org-id-1',
    username: 'test@example.com',
    displayName: 'Test User',
    label: 'test-label',
    orgName: 'TestOrg',
    source: 'DESKTOP' as const,
    connectionError: null,
    ...overrides,
  };
}

function buildJetstreamOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    name: 'Test Group',
    description: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    orgs: [],
    ...overrides,
  };
}

function buildOrgsPersistence(overrides: Record<string, unknown> = {}) {
  return {
    jetstreamOrganizations: [],
    salesforceOrgs: [],
    salesforceOrgsToIgnoreSyncFromWeb: [],
    ...overrides,
  };
}

// We need to dynamically import the module after mocks are set up
// and reset the module state between tests
async function importModule() {
  return await import('../persistence.service');
}

describe('persistence.service', () => {
  let service: Awaited<ReturnType<typeof importModule>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Default mock behavior
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(Buffer.from(''));
    mockWriteFileAtomicSync.mockImplementation(() => undefined);

    service = await importModule();
  });

  describe('getAppData', () => {
    it('should create a new app data file if none exists', () => {
      mockExistsSync.mockReturnValue(false);

      const result = service.getAppData();

      expect(result).toBeDefined();
      expect(result.deviceId).toBeDefined();
      // Should have written the file
      expect(mockWriteFileAtomicSync).toHaveBeenCalled();
    });

    it('should read existing app data from file', () => {
      const appData = { deviceId: 'test-device', accessToken: 'test-token', expiresAt: 123, lastChecked: 456 };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(appData)}`));

      const result = service.getAppData();

      expect(result.deviceId).toBe('test-device');
      expect(result.accessToken).toBe('test-token');
    });

    it('should return cached app data on subsequent calls', () => {
      const appData = { deviceId: 'cached-device' };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(appData)}`));

      const first = service.getAppData();
      const second = service.getAppData();

      expect(first).toBe(second);
      // readFileSync should only be called once (first call), second uses cache
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should fallback to defaults if file is corrupt', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from('encrypted:not-valid-json'));

      const result = service.getAppData();

      expect(result).toBeDefined();
      expect(result.deviceId).toBeDefined();
    });
  });

  describe('setAppData', () => {
    it('should write app data to file', () => {
      const appData = { deviceId: 'dev-1', accessToken: 'tok', expiresAt: 100, lastChecked: 200 };

      service.setAppData(appData as any);

      expect(mockWriteFileAtomicSync).toHaveBeenCalled();
      const writtenPath = mockWriteFileAtomicSync.mock.calls[0][0] as string;
      expect(writtenPath).toContain('app-data.json');
    });
  });

  describe('getUserPreferences', () => {
    it('should create default preferences if file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const prefs = service.getUserPreferences();

      expect(prefs).toBeDefined();
      expect(prefs.skipFrontdoorLogin).toBe(false);
      expect(prefs.recordSyncEnabled).toBe(false);
    });

    it('should read preferences from file', () => {
      const stored = { skipFrontdoorLogin: true, recordSyncEnabled: true };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(stored));

      const prefs = service.getUserPreferences();

      expect(prefs.skipFrontdoorLogin).toBe(true);
      expect(prefs.recordSyncEnabled).toBe(true);
    });
  });

  describe('updateUserPreferences', () => {
    it('should merge and persist preferences', () => {
      mockExistsSync.mockReturnValue(false);

      const result = service.updateUserPreferences({ skipFrontdoorLogin: true });

      expect(result.skipFrontdoorLogin).toBe(true);
      expect(mockWriteFileAtomicSync).toHaveBeenCalled();
    });
  });

  describe('Salesforce Orgs', () => {
    function setupOrgs(data = buildOrgsPersistence()) {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(data)}`));
    }

    describe('getSalesforceOrgs', () => {
      it('should return empty array when no orgs file exists', () => {
        mockExistsSync.mockReturnValue(false);

        const orgs = service.getSalesforceOrgs();

        expect(orgs).toEqual([]);
      });

      it('should return orgs from file', () => {
        const org = buildSalesforceOrg();
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));

        const orgs = service.getSalesforceOrgs();

        expect(orgs).toHaveLength(1);
        expect(orgs[0].uniqueId).toBe('org-1');
      });
    });

    describe('createOrUpdateSalesforceOrg', () => {
      it('should create a new org when it does not exist', () => {
        setupOrgs();

        const result = service.createOrUpdateSalesforceOrg(buildSalesforceOrg());

        expect(result.uniqueId).toBe('org-1');
        expect(result.source).toBe('DESKTOP');
        expect(service.getSalesforceOrgs()).toHaveLength(1);
      });

      it('should update an existing org', () => {
        const org = buildSalesforceOrg();
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));

        // Force read from file
        service.getSalesforceOrgs();

        const result = service.createOrUpdateSalesforceOrg(
          buildSalesforceOrg({ label: 'updated-label', instanceUrl: 'https://updated.salesforce.com' }),
        );

        expect(result.label).toBe('updated-label');
        expect(result.instanceUrl).toBe('https://updated.salesforce.com');
        expect(service.getSalesforceOrgs()).toHaveLength(1);
      });

      it('should set connectionError when provided', () => {
        setupOrgs();

        const result = service.createOrUpdateSalesforceOrg(buildSalesforceOrg(), { connectionError: 'Auth failed' });

        expect(result.connectionError).toBe('Auth failed');
      });

      it('should clear connectionError when not provided', () => {
        const org = buildSalesforceOrg({ connectionError: 'old error' });
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
        service.getSalesforceOrgs();

        const result = service.createOrUpdateSalesforceOrg(buildSalesforceOrg());

        expect(result.connectionError).toBeNull();
      });
    });

    describe('removeSalesforceOrg', () => {
      it('should remove an org by uniqueId', () => {
        const org = buildSalesforceOrg();
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
        service.getSalesforceOrgs();

        const remaining = service.removeSalesforceOrg('org-1');

        expect(remaining).toHaveLength(0);
      });

      it('should add web-sourced orgs to ignore list when removed', () => {
        const org = buildSalesforceOrg({ source: 'WEB' });
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
        service.getSalesforceOrgs();

        service.removeSalesforceOrg('org-1');

        // Verify the ignore list was updated by checking the written data
        expect(mockWriteFileAtomicSync).toHaveBeenCalled();
      });

      it('should not add desktop-sourced orgs to ignore list', () => {
        const org = buildSalesforceOrg({ source: 'DESKTOP' });
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
        service.getSalesforceOrgs();

        service.removeSalesforceOrg('org-1');

        // The written data should have empty ignore list
        const writeCall = mockWriteFileAtomicSync.mock.calls.find((call) => String(call[0]).includes('orgs.json'));
        expect(writeCall).toBeDefined();
      });
    });

    describe('updateSalesforceOrg', () => {
      it('should update label and color of an org', () => {
        const org = buildSalesforceOrg();
        setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
        service.getSalesforceOrgs();

        const result = service.updateSalesforceOrg('org-1', { label: 'New Label', color: '#ff0000' });

        const updated = result.find((o) => o.uniqueId === 'org-1');
        expect(updated?.label).toBe('New Label');
        expect(updated?.color).toBe('#ff0000');
      });
    });
  });

  describe('Jetstream Org Groups', () => {
    function setupOrgs(data = buildOrgsPersistence()) {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(data)}`));
    }

    describe('getOrgGroups', () => {
      it('should return empty array when no org groups exist', () => {
        setupOrgs();

        const groups = service.getOrgGroups();

        expect(groups).toEqual([]);
      });

      it('should return org groups from file', () => {
        const group = buildJetstreamOrg();
        setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [group] }));

        const groups = service.getOrgGroups();

        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('Test Group');
      });
    });

    describe('createOrgGroup', () => {
      it('should create a new org group with generated id', () => {
        setupOrgs();
        service.getOrgGroups();

        const result = service.createOrgGroup({ name: 'New Group', description: 'A description' });

        expect(result.id).toBeDefined();
        expect(result.name).toBe('New Group');
        expect(result.description).toBe('A description');
        expect(result.orgs).toEqual([]);
        expect(service.getOrgGroups()).toHaveLength(1);
      });
    });

    describe('updateOrgGroup', () => {
      it('should update an existing org group', () => {
        const group = buildJetstreamOrg();
        setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [group] }));
        service.getOrgGroups();

        const result = service.updateOrgGroup('group-1', { name: 'Updated Name', description: 'Updated desc' });

        expect(result.name).toBe('Updated Name');
        expect(result.description).toBe('Updated desc');
      });

      it('should throw if org group not found', () => {
        setupOrgs();
        service.getOrgGroups();

        expect(() => service.updateOrgGroup('nonexistent', { name: 'x', description: null })).toThrow(
          'Jetstream organization with id nonexistent not found',
        );
      });
    });

    describe('deleteOrgGroup', () => {
      it('should remove the org group and unlink orgs', () => {
        const group = buildJetstreamOrg({ orgs: [{ uniqueId: 'org-1' }] });
        const org = buildSalesforceOrg({ jetstreamOrganizationId: 'group-1' });
        setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [group], salesforceOrgs: [org] }));
        service.getOrgGroups();

        const remaining = service.deleteOrgGroup('group-1');

        expect(remaining).toHaveLength(0);
        const orgs = service.getSalesforceOrgs();
        expect(orgs[0].jetstreamOrganizationId).toBeNull();
      });
    });

    describe('deleteOrgGroupAndAllOrgs', () => {
      it('should remove the org group and all its orgs', () => {
        const group = buildJetstreamOrg({ orgs: [{ uniqueId: 'org-1' }] });
        const org = buildSalesforceOrg({ jetstreamOrganizationId: 'group-1' });
        const otherOrg = buildSalesforceOrg({ uniqueId: 'org-2', jetstreamOrganizationId: null });
        setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [group], salesforceOrgs: [org, otherOrg] }));
        service.getOrgGroups();

        service.deleteOrgGroupAndAllOrgs('group-1');

        expect(service.getOrgGroups()).toHaveLength(0);
        expect(service.getSalesforceOrgs()).toHaveLength(1);
        expect(service.getSalesforceOrgs()[0].uniqueId).toBe('org-2');
      });
    });

    describe('moveSalesforceOrgToJetstreamOrg', () => {
      it('should move an org to a different group', () => {
        const group1 = buildJetstreamOrg({ orgs: [{ uniqueId: 'org-1' }] });
        const group2 = buildJetstreamOrg({ id: 'group-2', name: 'Group 2' });
        const org = buildSalesforceOrg({ jetstreamOrganizationId: 'group-1' });
        setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [group1, group2], salesforceOrgs: [org] }));
        service.getOrgGroups();

        const result = service.moveSalesforceOrgToJetstreamOrg({ uniqueId: 'org-1', orgGroupId: 'group-2' });

        const updatedGroup1 = result.jetstreamOrganizations.find((g) => g.id === 'group-1');
        const updatedGroup2 = result.jetstreamOrganizations.find((g) => g.id === 'group-2');
        expect(updatedGroup1?.orgs).toHaveLength(0);
        expect(updatedGroup2?.orgs).toHaveLength(1);
        expect(result.salesforceOrgs[0].jetstreamOrganizationId).toBe('group-2');
      });
    });
  });

  describe('mergeWebAppOrgsWithDesktopOrgs', () => {
    function setupOrgs(data = buildOrgsPersistence()) {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(data)}`));
    }

    it('should add new orgs from web app', () => {
      setupOrgs();
      // Initialize the orgs from file
      service.getSalesforceOrgs();

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'web-org-1', username: 'web@test.com' }) as any],
        organizations: [],
      };

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      const orgs = service.getSalesforceOrgs();
      expect(orgs.some((o) => o.uniqueId === 'web-org-1')).toBe(true);
    });

    it('should skip orgs that already exist on desktop', () => {
      const existingOrg = buildSalesforceOrg({ uniqueId: 'org-1' });
      setupOrgs(buildOrgsPersistence({ salesforceOrgs: [existingOrg] }));
      service.getSalesforceOrgs();

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'org-1' }) as any],
        organizations: [],
      };

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      expect(service.getSalesforceOrgs()).toHaveLength(1);
    });

    it('should skip orgs in the ignore list even when no matching desktop org exists', () => {
      setupOrgs(
        buildOrgsPersistence({
          salesforceOrgsToIgnoreSyncFromWeb: ['ignored-org'],
        }),
      );

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'ignored-org' }) as any],
        organizations: [],
      };

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      expect(service.getSalesforceOrgs()).toHaveLength(0);
    });

    it('should create org groups from web app when needed', () => {
      setupOrgs();
      service.getOrgGroups();

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'web-org-1', jetstreamOrganizationId: 'web-group-1' }) as any],
        organizations: [{ id: 'web-group-1', name: 'Web Group', description: 'From web' }],
      } as OrgsWithGroupResponse;

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      const groups = service.getOrgGroups();
      expect(groups.some((g) => g.name === 'Web Group')).toBe(true);
    });

    it('should match existing groups by name instead of creating duplicates', () => {
      const existingGroup = buildJetstreamOrg({ name: 'Shared Group' });
      setupOrgs(buildOrgsPersistence({ jetstreamOrganizations: [existingGroup] }));
      service.getOrgGroups();

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'web-org-1', jetstreamOrganizationId: 'web-group-1' }) as any],
        organizations: [{ id: 'web-group-1', name: 'Shared Group', description: null }],
      } as OrgsWithGroupResponse;

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      // Should not create a duplicate group
      const groups = service.getOrgGroups();
      const sharedGroups = groups.filter((g) => g.name === 'Shared Group');
      expect(sharedGroups).toHaveLength(1);
    });

    it('should mark synced web orgs with source WEB, invalid access token, and connection error', () => {
      setupOrgs();
      service.getSalesforceOrgs();

      const webOrgs = {
        orgs: [buildSalesforceOrg({ uniqueId: 'web-org-1' }) as any],
        organizations: [],
      };

      service.mergeWebAppOrgsWithDesktopOrgs(webOrgs);

      const orgs = service.getSalesforceOrgs();
      const synced = orgs.find((o) => o.uniqueId === 'web-org-1');
      expect(synced?.source).toBe('WEB');
      expect(synced?.accessToken).toBe('invalid');
      expect(synced?.connectionError).toBe(WEB_ORG_SYNC_CONNECTION_ERR_MESSAGE);
    });
  });

  describe('getFullUserProfile', () => {
    it('should throw if no user profile exists', () => {
      mockExistsSync.mockReturnValue(false);

      // getAppData will create defaults with no userProfile
      expect(() => service.getFullUserProfile()).toThrow('User profile not found');
    });
  });

  describe('writeFile fallback', () => {
    it('should fallback to writeFileSync when writeFileAtomic throws', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileAtomicSync.mockImplementation(() => {
        throw new Error('atomic write failed');
      });

      // getAppData triggers a write internally
      service.getAppData();

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('updateAccessTokens', () => {
    function setupOrgs(data = buildOrgsPersistence()) {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(data)}`));
    }

    it('should encrypt and update access tokens for an org', () => {
      const org = buildSalesforceOrg();
      setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
      service.getSalesforceOrgs();

      const result = service.updateAccessTokens('org-1', {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const updated = result.find((o) => o.uniqueId === 'org-1');
      expect(updated?.accessToken).toBeDefined();
      // The token should be encrypted (base64 of the encrypted buffer)
      expect(updated?.accessToken).not.toBe('new-access');
    });
  });

  describe('getSalesforceOrgById', () => {
    function setupOrgs(data = buildOrgsPersistence()) {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(`encrypted:${JSON.stringify(data)}`));
    }

    it('should return the org when found', () => {
      const org = buildSalesforceOrg();
      setupOrgs(buildOrgsPersistence({ salesforceOrgs: [org] }));
      service.getSalesforceOrgs();

      const result = service.getSalesforceOrgById('org-1');

      expect(result?.uniqueId).toBe('org-1');
    });

    it('should return undefined when not found', () => {
      setupOrgs();
      service.getSalesforceOrgs();

      const result = service.getSalesforceOrgById('nonexistent');

      expect(result).toBeUndefined();
    });
  });
});
