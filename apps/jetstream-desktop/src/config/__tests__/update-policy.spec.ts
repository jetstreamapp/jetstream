import { describe, expect, it } from 'vitest';
import {
  computeNsisAppGuid,
  getMacOsManagedPreferenceDomains,
  isWindowsPolicyFileLocationTrusted,
  isWindowsPolicyFileOwnerTrusted,
  parseManagedPolicyFile,
  resolveUpdatePolicy,
  toBoolean,
  type UpdatePolicyEnvironment,
} from '../update-policy';

const NO_POLICY: UpdatePolicyEnvironment = {
  disabledByCommandLine: false,
  disabledByEnvironment: null,
  disabledByManagedPolicy: null,
  perMachineInstall: false,
  isPortableBuild: false,
};

describe('update-policy#computeNsisAppGuid', () => {
  /**
   * Pins the GUID the current appId produces. electron-builder derives the installer's registry key
   * from it, so if this value ever changes the per-machine detection is silently reading the wrong
   * key - which would bring back the every-launch UAC prompt this whole feature exists to stop.
   */
  it('derives the same GUID electron-builder generates for the Jetstream appId', () => {
    expect(computeNsisAppGuid('app.getjetstream')).toBe('1cc64917-37e3-5b25-bfd9-19c922591cc1');
  });

  it('produces a well-formed v5 UUID', () => {
    expect(computeNsisAppGuid('com.example.app')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('update-policy#toBoolean', () => {
  it.each([
    ['1', true],
    ['0x1', true],
    ['true', true],
    ['YES', true],
    [' on ', true],
    ['0', false],
    ['0x0', false],
    ['false', false],
    ['no', false],
    [true, true],
    [false, false],
    [1, true],
    [0, false],
  ])('parses %j as %j', (value, expected) => {
    expect(toBoolean(value)).toBe(expected);
  });

  it.each([[undefined], [null], [''], ['maybe'], [{}]])('treats %j as unset rather than guessing', (value) => {
    expect(toBoolean(value)).toBeNull();
  });
});

describe('update-policy#getMacOsManagedPreferenceDomains', () => {
  it('consults the device-channel profile before the user-channel one', () => {
    expect(getMacOsManagedPreferenceDomains('jdoe')).toEqual([
      '/Library/Managed Preferences/app.getjetstream',
      '/Library/Managed Preferences/jdoe/app.getjetstream',
    ]);
  });
});

describe('update-policy#parseManagedPolicyFile', () => {
  it('reads the documented key with any of the accepted truthy spellings', () => {
    expect(parseManagedPolicyFile({ DisableAutoUpdate: true })).toBe(true);
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 'yes' })).toBe(true);
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 0 })).toBe(false);
  });

  it('treats a file without the exact key as no opinion', () => {
    expect(parseManagedPolicyFile({})).toBeNull();
    expect(parseManagedPolicyFile({ disableAutoUpdate: true })).toBeNull();
  });

  it('treats a malformed file as no opinion', () => {
    expect(parseManagedPolicyFile(null)).toBeNull();
    expect(parseManagedPolicyFile('DisableAutoUpdate')).toBeNull();
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 'maybe' })).toBeNull();
  });
});

describe('update-policy#isWindowsPolicyFileOwnerTrusted', () => {
  /**
   * The default %ProgramData% ACL lets a standard user create the policy folder and file, so only a
   * file owned by SYSTEM (MDM/GPO) or the Administrators group counts as an administrator decision.
   */
  it('trusts a file owned by SYSTEM or the built-in Administrators group', () => {
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-18')).toBe(true);
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-32-544')).toBe(true);
    expect(isWindowsPolicyFileOwnerTrusted(' s-1-5-32-544\r\n')).toBe(true);
  });

  it('rejects a file owned by any user account, or whose owner could not be read', () => {
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-21-3623811015-3361044348-30300820-1013')).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted('BUILTIN\\Administrators')).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted('')).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted(null)).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted(undefined)).toBe(false);
  });
});

describe('update-policy#resolveUpdatePolicy', () => {
  it('enables updates when nothing is configured', () => {
    expect(resolveUpdatePolicy(NO_POLICY, true)).toEqual({
      autoUpdateEnabled: true,
      allowManualCheck: true,
      source: 'default',
      managed: false,
      perMachineInstall: false,
    });
  });

  it('lets the user turn off automatic updates but keeps manual checks working', () => {
    expect(resolveUpdatePolicy(NO_POLICY, false)).toEqual({
      autoUpdateEnabled: false,
      allowManualCheck: true,
      source: 'user-preference',
      managed: false,
      perMachineInstall: false,
    });
  });

  it('removes the manual check too when an administrator disables updates', () => {
    expect(resolveUpdatePolicy({ ...NO_POLICY, disabledByManagedPolicy: true }, true)).toEqual({
      autoUpdateEnabled: false,
      allowManualCheck: false,
      source: 'managed-policy',
      managed: true,
      perMachineInstall: false,
    });
  });

  it('lets an administrator policy override a user who disabled updates', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByManagedPolicy: false }, false);
    expect(policy.autoUpdateEnabled).toBe(true);
    expect(policy.managed).toBe(true);
    expect(policy.source).toBe('managed-policy');
  });

  it('prefers the command line over every other source', () => {
    const policy = resolveUpdatePolicy(
      { ...NO_POLICY, disabledByCommandLine: true, disabledByEnvironment: false, disabledByManagedPolicy: false },
      true,
    );
    expect(policy.autoUpdateEnabled).toBe(false);
    expect(policy.source).toBe('command-line');
  });

  it('prefers the environment variable over the managed policy', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByEnvironment: true, disabledByManagedPolicy: false }, true);
    expect(policy.autoUpdateEnabled).toBe(false);
    expect(policy.source).toBe('environment');
  });

  it('falls through an environment variable that is set but unparseable', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByEnvironment: null, disabledByManagedPolicy: true }, true);
    expect(policy.source).toBe('managed-policy');
  });

  it('turns updates off entirely for the portable build', () => {
    expect(resolveUpdatePolicy({ ...NO_POLICY, isPortableBuild: true }, true)).toEqual({
      autoUpdateEnabled: false,
      allowManualCheck: false,
      source: 'portable',
      managed: true,
      perMachineInstall: false,
    });
  });

  it('keeps the portable build from updating even when a policy tries to enable updates', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, isPortableBuild: true, disabledByManagedPolicy: false }, true);
    expect(policy.autoUpdateEnabled).toBe(false);
    expect(policy.source).toBe('portable');
  });

  it('carries the per-machine install flag through every decision', () => {
    const environment = { ...NO_POLICY, perMachineInstall: true };
    expect(resolveUpdatePolicy(environment, true).perMachineInstall).toBe(true);
    expect(resolveUpdatePolicy(environment, false).perMachineInstall).toBe(true);
    expect(resolveUpdatePolicy({ ...environment, disabledByManagedPolicy: true }, true).perMachineInstall).toBe(true);
  });
});

describe('update-policy#isWindowsPolicyFileLocationTrusted', () => {
  const ADMINISTRATORS = 'S-1-5-32-544';
  const SYSTEM = 'S-1-5-18';
  const USERS = 'S-1-5-32-545';
  const EVERYONE = 'S-1-1-0';
  const STANDARD_USER = 'S-1-5-21-1-2-3-1001';

  // Access masks as `[int]$rule.FileSystemRights` reports them (winnt.h bits)
  const FULL_CONTROL = 0x1f01ff;
  const MODIFY = 0x301bf;
  const READ_AND_EXECUTE = 0x200a9;
  const WRITE = 0x116;
  const SYNCHRONIZE = 0x100000;
  const CREATE_FILES_AND_FOLDERS = 0x6; // FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY, the same bits as WriteData | AppendData
  const DELETE_SUBDIRECTORIES_AND_FILES = 0x40;
  const GENERIC_ALL = 0x10000000;
  const GENERIC_WRITE = 0x40000000;
  const GENERIC_READ_AND_EXECUTE = -1610612736; // GENERIC_READ | GENERIC_EXECUTE as a negative int32

  /** What an administrator-created file and folder under %ProgramData% look like with the default inherited ACL */
  const defaultFileRules = [
    { sid: SYSTEM, type: 'Allow', rights: FULL_CONTROL },
    { sid: ADMINISTRATORS, type: 'Allow', rights: FULL_CONTROL },
    { sid: USERS, type: 'Allow', rights: READ_AND_EXECUTE | SYNCHRONIZE },
  ];
  const defaultDirRules = [
    { sid: SYSTEM, type: 'Allow', rights: FULL_CONTROL },
    { sid: ADMINISTRATORS, type: 'Allow', rights: FULL_CONTROL },
    { sid: USERS, type: 'Allow', rights: READ_AND_EXECUTE | SYNCHRONIZE },
    // Every user may create files and folders under %ProgramData%; that cannot replace an existing administrator-owned file
    { sid: USERS, type: 'Allow', rights: CREATE_FILES_AND_FOLDERS },
    // Inherit-only entries carry generic masks: CREATOR OWNER full control, Users generic read + execute
    { sid: 'S-1-3-0', type: 'Allow', rights: GENERIC_ALL },
    { sid: USERS, type: 'Allow', rights: GENERIC_READ_AND_EXECUTE },
  ];
  const trusted = { fileOwner: ADMINISTRATORS, dirOwner: SYSTEM, fileRules: defaultFileRules, dirRules: defaultDirRules };

  it('trusts an administrator-owned file in an administrator-owned folder with the default ACL', () => {
    expect(isWindowsPolicyFileLocationTrusted(trusted)).toBe(true);
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, fileOwner: SYSTEM, dirOwner: ADMINISTRATORS })).toBe(true);
  });

  it('rejects an administrator-owned file inside a folder a standard user created', () => {
    // The user who owns the folder could swap the file between the ownership check and the read
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, dirOwner: STANDARD_USER })).toBe(false);
  });

  it('rejects a user-owned file inside an administrator-owned folder', () => {
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, fileOwner: STANDARD_USER })).toBe(false);
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, fileOwner: null })).toBe(false);
  });

  it('rejects a file whose ACL lets every user change it, whoever owns it', () => {
    const withFileRule = (rule: { sid: string; type: string; rights: number }) => ({ ...trusted, fileRules: [...defaultFileRules, rule] });
    expect(isWindowsPolicyFileLocationTrusted(withFileRule({ sid: USERS, type: 'Allow', rights: MODIFY | SYNCHRONIZE }))).toBe(false);
    expect(
      isWindowsPolicyFileLocationTrusted(withFileRule({ sid: EVERYONE, type: 'Allow', rights: WRITE | READ_AND_EXECUTE | SYNCHRONIZE })),
    ).toBe(false);
    // The bits the enum would display as "CreateFiles" on a file are WriteData, so the alias cannot hide a write grant
    expect(isWindowsPolicyFileLocationTrusted(withFileRule({ sid: USERS, type: 'Allow', rights: CREATE_FILES_AND_FOLDERS }))).toBe(false);
    expect(isWindowsPolicyFileLocationTrusted(withFileRule({ sid: EVERYONE, type: 'Allow', rights: GENERIC_WRITE }))).toBe(false);
  });

  it('rejects a folder whose ACL lets every user remove or replace its files', () => {
    const withDirRule = (rule: { sid: string; type: string; rights: number }) => ({ ...trusted, dirRules: [...defaultDirRules, rule] });
    expect(isWindowsPolicyFileLocationTrusted(withDirRule({ sid: EVERYONE, type: 'Allow', rights: FULL_CONTROL }))).toBe(false);
    expect(
      isWindowsPolicyFileLocationTrusted(withDirRule({ sid: USERS, type: 'Allow', rights: DELETE_SUBDIRECTORIES_AND_FILES | SYNCHRONIZE })),
    ).toBe(false);
  });

  it('treats a grant to a logon class every user signs in through like a grant to Users', () => {
    const CONSOLE_LOGON = 'S-1-2-1';
    const NETWORK = 'S-1-5-2';
    const REMOTE_INTERACTIVE_LOGON = 'S-1-5-14';
    const THIS_ORGANIZATION = 'S-1-5-15';
    for (const sid of [CONSOLE_LOGON, NETWORK, REMOTE_INTERACTIVE_LOGON, THIS_ORGANIZATION]) {
      expect(
        isWindowsPolicyFileLocationTrusted({
          ...trusted,
          fileRules: [...defaultFileRules, { sid, type: 'Allow', rights: MODIFY | SYNCHRONIZE }],
        }),
      ).toBe(false);
      expect(
        isWindowsPolicyFileLocationTrusted({
          ...trusted,
          dirRules: [...defaultDirRules, { sid, type: 'Allow', rights: DELETE_SUBDIRECTORIES_AND_FILES }],
        }),
      ).toBe(false);
    }
  });

  it('rejects a file or folder that reports no access rules at all', () => {
    // A NULL DACL grants everyone full access yet yields no rules, and a missing field must not pass either
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, fileRules: [] })).toBe(false);
    expect(isWindowsPolicyFileLocationTrusted({ ...trusted, dirRules: [] })).toBe(false);
  });

  it('ignores deny entries and named accounts', () => {
    expect(
      isWindowsPolicyFileLocationTrusted({ ...trusted, fileRules: [...defaultFileRules, { sid: USERS, type: 'Deny', rights: MODIFY }] }),
    ).toBe(true);
    expect(
      isWindowsPolicyFileLocationTrusted({
        ...trusted,
        fileRules: [...defaultFileRules, { sid: STANDARD_USER, type: 'Allow', rights: MODIFY }],
      }),
    ).toBe(true);
  });
});
