import { ScratchOrgCreateRequestSchema } from '@jetstream/api-types';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConnection } from '../connection';
import {
  buildScratchOrgInfoRecord,
  createScratchOrgInfo,
  getScratchOrgAuthLoginUrl,
  getScratchOrgAuthRequest,
  getScratchOrgInfoForAuth,
  ScratchOrgInfoAuthRecord,
} from '../scratch-org.utils';

const CONNECTED_APP = { consumerKey: 'jetstream-consumer-key', callbackUrl: 'https://getjetstream.app/oauth/sfdc/callback' };

function buildAuthRecord(overrides: Partial<ScratchOrgInfoAuthRecord> = {}): ScratchOrgInfoAuthRecord {
  return {
    Id: '2SR000000000001AAA',
    Status: 'Active',
    AuthCode: 'auth-code',
    LoginUrl: 'https://flow-power-1234-dev-ed.scratch.my.salesforce.com',
    SignupUsername: 'test-abc@example.com',
    ConnectedAppConsumerKey: CONNECTED_APP.consumerKey,
    ConnectedAppCallbackUrl: CONNECTED_APP.callbackUrl,
    ...overrides,
  };
}

describe('buildScratchOrgInfoRecord', () => {
  it('maps the request to ScratchOrgInfo fields and adds the connected app', () => {
    const request = ScratchOrgCreateRequestSchema.parse({
      orgName: 'My Org',
      edition: 'Developer',
      durationDays: 14,
      adminEmail: 'admin@example.com',
      features: ['Communities', 'ServiceCloud'],
      hasSampleData: true,
      release: 'Preview',
      username: 'Admin@Example.com',
    });

    expect(buildScratchOrgInfoRecord(request, CONNECTED_APP)).toEqual({
      OrgName: 'My Org',
      Edition: 'Developer',
      DurationDays: 14,
      AdminEmail: 'admin@example.com',
      Features: 'Communities;ServiceCloud',
      HasSampleData: true,
      Release: 'Preview',
      Username: 'admin@example.com',
      ConnectedAppConsumerKey: CONNECTED_APP.consumerKey,
      ConnectedAppCallbackUrl: CONNECTED_APP.callbackUrl,
    });
  });

  it('leaves out everything that was not provided so Salesforce applies its defaults', () => {
    const request = ScratchOrgCreateRequestSchema.parse({ edition: 'Enterprise', orgName: '  ', description: '' });

    expect(buildScratchOrgInfoRecord(request, CONNECTED_APP)).toEqual({
      OrgName: 'Company',
      Edition: 'Enterprise',
      DurationDays: 7,
      ConnectedAppConsumerKey: CONNECTED_APP.consumerKey,
      ConnectedAppCallbackUrl: CONNECTED_APP.callbackUrl,
    });
  });

  it('supports org shapes, which do not have an edition', () => {
    const request = ScratchOrgCreateRequestSchema.parse({ sourceOrg: '00D000000000001' });
    const record = buildScratchOrgInfoRecord(request, CONNECTED_APP);

    expect(record.SourceOrg).toBe('00D000000000001');
    expect(record).not.toHaveProperty('Edition');
  });
});

describe('ScratchOrgCreateRequestSchema', () => {
  it('requires an edition, an org shape or a snapshot', () => {
    expect(ScratchOrgCreateRequestSchema.safeParse({}).success).toBe(false);
    expect(ScratchOrgCreateRequestSchema.safeParse({ edition: 'Developer' }).success).toBe(true);
    expect(ScratchOrgCreateRequestSchema.safeParse({ snapshot: 'my-snapshot' }).success).toBe(true);
  });

  it('rejects a request with both an org shape and a snapshot', () => {
    expect(ScratchOrgCreateRequestSchema.safeParse({ sourceOrg: '00D000000000001', snapshot: 'my-snapshot' }).success).toBe(false);
  });

  it('limits the duration to what Salesforce allows', () => {
    expect(ScratchOrgCreateRequestSchema.safeParse({ edition: 'Developer', durationDays: 0 }).success).toBe(false);
    expect(ScratchOrgCreateRequestSchema.safeParse({ edition: 'Developer', durationDays: 31 }).success).toBe(false);
    expect(ScratchOrgCreateRequestSchema.safeParse({ edition: 'Developer', durationDays: 30 }).success).toBe(true);
  });

  it('does not accept connected app fields from the client', () => {
    const request = ScratchOrgCreateRequestSchema.parse({ edition: 'Developer', connectedAppConsumerKey: 'other-app' });
    expect(request).not.toHaveProperty('connectedAppConsumerKey');
  });
});

describe('createScratchOrgInfo', () => {
  function buildConnection(result: unknown) {
    const recordOperation = vi.fn().mockResolvedValue([result]);
    return { connection: { sobject: { recordOperation } } as unknown as ApiConnection, recordOperation };
  }

  it('creates the ScratchOrgInfo record and returns its id', async () => {
    const { connection, recordOperation } = buildConnection({ success: true, id: '2SR000000000001AAA' });
    const request = ScratchOrgCreateRequestSchema.parse({ edition: 'Developer' });

    await expect(createScratchOrgInfo(connection, request, CONNECTED_APP)).resolves.toBe('2SR000000000001AAA');
    expect(recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        sobject: 'ScratchOrgInfo',
        operation: 'create',
        records: [expect.objectContaining({ ConnectedAppConsumerKey: CONNECTED_APP.consumerKey })],
      }),
    );
  });

  it('surfaces the reason Salesforce rejected the request', async () => {
    const { connection } = buildConnection({
      success: false,
      errors: [{ message: 'The daily scratch org limit has been reached', statusCode: 'LIMIT_EXCEEDED', fields: [] }],
    });
    const request = ScratchOrgCreateRequestSchema.parse({ edition: 'Developer' });

    await expect(createScratchOrgInfo(connection, request, CONNECTED_APP)).rejects.toThrow('The daily scratch org limit has been reached');
  });
});

describe('getScratchOrgInfoForAuth', () => {
  it('throws when the scratch org is not in the Dev Hub', async () => {
    const connection = {
      query: { query: vi.fn().mockResolvedValue({ queryResults: { records: [] } }) },
    } as unknown as ApiConnection;

    await expect(getScratchOrgInfoForAuth(connection, '2SR000000000001AAA')).rejects.toThrow('could not be found');
  });
});

describe('getScratchOrgAuthLoginUrl', () => {
  it('returns the origin of the My Domain', () => {
    expect(getScratchOrgAuthLoginUrl({ LoginUrl: 'https://flow-power-1234-dev-ed.scratch.my.salesforce.com/' })).toBe(
      'https://flow-power-1234-dev-ed.scratch.my.salesforce.com',
    );
  });

  it.each([
    null,
    '',
    'not a url',
    'http://flow-power-1234-dev-ed.scratch.my.salesforce.com',
    'https://evil.example.com',
    'https://salesforce.com.evil.example.com',
    'https://evilsalesforce.com',
    'https://user:pass@test.my.salesforce.com',
    'https://test.my.salesforce.com:8443',
    'https://test.my.salesforce.com.',
    'https://help.salesforce.com',
    'https://cs42.salesforce.com',
  ])('refuses %s, the tokens of a scratch org must only ever be requested from Salesforce', (loginUrl) => {
    expect(getScratchOrgAuthLoginUrl({ LoginUrl: loginUrl })).toBeNull();
  });
});

describe('getScratchOrgAuthRequest', () => {
  it('allows an active scratch org that was requested with our connected app', () => {
    expect(getScratchOrgAuthRequest(buildAuthRecord(), CONNECTED_APP)).toEqual({
      blocker: null,
      authCode: 'auth-code',
      loginUrl: 'https://flow-power-1234-dev-ed.scratch.my.salesforce.com',
    });
  });

  it.each([
    ['Deleted', 'deleted'],
    ['Error', 'failed to create'],
    ['Creating', 'still being created'],
    ['New', 'still being created'],
  ] as const)('refuses a scratch org with status %s', (Status, message) => {
    expect(getScratchOrgAuthRequest(buildAuthRecord({ Status }), CONNECTED_APP).blocker).toContain(message);
  });

  it('refuses a scratch org that was requested by another tool', () => {
    const record = buildAuthRecord({
      ConnectedAppConsumerKey: 'PlatformCLI',
      ConnectedAppCallbackUrl: 'http://localhost:1717/OauthRedirect',
    });
    expect(getScratchOrgAuthRequest(record, CONNECTED_APP).blocker).toContain('different application');
  });

  it('refuses a scratch org that was requested with our consumer key but another callback', () => {
    const record = buildAuthRecord({ ConnectedAppCallbackUrl: 'https://evil.example.com/callback' });
    expect(getScratchOrgAuthRequest(record, CONNECTED_APP).blocker).toContain('different application');
  });

  it('refuses a scratch org without an auth code or a valid login url', () => {
    expect(getScratchOrgAuthRequest(buildAuthRecord({ AuthCode: null }), CONNECTED_APP).blocker).toContain('authorization code');
    expect(getScratchOrgAuthRequest(buildAuthRecord({ LoginUrl: 'https://evil.example.com' }), CONNECTED_APP).blocker).toContain(
      'login url',
    );
  });
});
