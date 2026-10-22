import { describe, expect, it } from 'vitest';
import { isWindowsPolicyFileLocationTrusted, isWindowsPolicyFileOwnerTrusted, parseWindowsPolicyFileProbe } from '../windows-file-trust';

describe('windows-file-trust#isWindowsPolicyFileOwnerTrusted', () => {
  /**
   * The default %ProgramData% ACL lets a standard user create the policy folder and file, so only a
   * file owned by SYSTEM (MDM/GPO) or the Administrators group counts as an administrator decision.
   */
  it('trusts a file owned by SYSTEM or the built-in Administrators group', () => {
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-18')).toBe(true);
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-32-544')).toBe(true);
    expect(isWindowsPolicyFileOwnerTrusted(' s-1-5-32-544\r\n')).toBe(true);
  });

  it('rejects a file owned by any user account', () => {
    expect(isWindowsPolicyFileOwnerTrusted('S-1-5-21-3623811015-3361044348-30300820-1013')).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted('BUILTIN\\Administrators')).toBe(false);
    expect(isWindowsPolicyFileOwnerTrusted('')).toBe(false);
  });
});

describe('windows-file-trust#isWindowsPolicyFileLocationTrusted', () => {
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
    // A NULL DACL grants everyone full access yet yields no rules
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

describe('windows-file-trust#parseWindowsPolicyFileProbe', () => {
  const rule = { sid: 'S-1-5-18', type: 'Allow', rights: 0x1f01ff };
  const probe = { fileOwner: 'S-1-5-32-544', dirOwner: 'S-1-5-18', fileRules: [rule], dirRules: [rule], contents: '{}' };

  it('accepts the shape the PowerShell probe emits', () => {
    expect(parseWindowsPolicyFileProbe(probe)).toEqual(probe);
  });

  it('wraps a single rule that ConvertTo-Json unwrapped, and reads a missing rule list as empty', () => {
    expect(parseWindowsPolicyFileProbe({ ...probe, fileRules: rule, dirRules: null })).toEqual({
      ...probe,
      fileRules: [rule],
      dirRules: [],
    });
    expect(parseWindowsPolicyFileProbe({ ...probe, dirRules: undefined })?.dirRules).toEqual([]);
  });

  it('rejects output whose owners, contents or access masks could not be read', () => {
    expect(parseWindowsPolicyFileProbe({ ...probe, fileOwner: null })).toBeNull();
    expect(parseWindowsPolicyFileProbe({ ...probe, dirOwner: undefined })).toBeNull();
    expect(parseWindowsPolicyFileProbe({ ...probe, contents: 42 })).toBeNull();
    expect(parseWindowsPolicyFileProbe({ ...probe, fileRules: [{ ...rule, rights: 'FullControl' }] })).toBeNull();
    expect(parseWindowsPolicyFileProbe({ ...probe, dirRules: [{ type: 'Allow', rights: 1 }] })).toBeNull();
    expect(parseWindowsPolicyFileProbe(null)).toBeNull();
  });
});
