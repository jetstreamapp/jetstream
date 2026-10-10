import type { UpdatePolicy, UpdatePolicySource } from '@jetstream/desktop/types';
import logger from 'electron-log';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * The one key every administrator channel shares: the value under the Windows registry key, the key
 * in a macOS configuration profile, and the property in the JSON policy file.
 */
const POLICY_KEY = 'DisableAutoUpdate';

/** Registry key an MDM/GPO writes to turn updates off for every user of a machine. */
const WINDOWS_POLICY_KEY = 'HKLM\\SOFTWARE\\Policies\\Jetstream';

/** macOS preference domain a configuration profile targets, and where MDM-delivered profiles land. */
const MACOS_PREFERENCE_DOMAIN = 'app.getjetstream';
const MACOS_MANAGED_PREFERENCES_DIR = '/Library/Managed Preferences';

const ENV_VAR = 'JETSTREAM_DISABLE_AUTO_UPDATE';
const CLI_FLAG = '--disable-auto-update';

/**
 * Must match `appId` in electron-builder.config.js — the installer's registry key is derived from
 * it. Electron does not expose the appId at runtime, so it is duplicated here and pinned by
 * update-policy.spec.ts, which asserts the GUID the current appId produces.
 */
const APP_ID = 'app.getjetstream';

/**
 * Namespace electron-builder uses to derive an app's NSIS GUID from its appId.
 * https://github.com/electron-userland/electron-builder — `ELECTRON_BUILDER_NS_UUID`
 */
const ELECTRON_BUILDER_NS_UUID = '50e065bc-3134-11e6-9bab-38c9862bdaf3';

/** Machine-wide config file, an alternative to the registry/profile channels above. */
function managedPolicyFilePath(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.ProgramData || 'C:\\ProgramData', 'Jetstream', 'policy.json');
    case 'darwin':
      return '/Library/Application Support/Jetstream/policy.json';
    default:
      return '/etc/jetstream/policy.json';
  }
}

/**
 * Recreate the GUID electron-builder generates for the NSIS installer, which is a UUID v5 of the
 * appId in electron-builder's own namespace (app-builder-lib `nsis/Defines.APP_GUID`). Derived
 * rather than hard-coded so it cannot silently drift if the appId ever changes — a stale GUID would
 * make the per-machine check below quietly report "not installed for all users" forever.
 */
export function computeNsisAppGuid(appId: string): string {
  const namespaceBytes = Buffer.from(ELECTRON_BUILDER_NS_UUID.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(Buffer.from(appId, 'utf-8')).digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A registry read that treats "no such key" as a normal answer. `reg query` exits non-zero both
 * when the value is absent and when something actually went wrong, and we cannot tell them apart,
 * so every failure resolves to null and the caller falls through to the next policy layer.
 */
async function readWindowsRegistryValue(key: string, value: string): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }
  try {
    // /reg:64 pins the 64-bit view, which is where the 64-bit NSIS installer writes (it runs
    // `SetRegView 64`); without it a 32-bit host process would silently read WOW6432Node instead.
    const { stdout } = await execFileAsync('reg.exe', ['query', key, '/v', value, '/reg:64'], { windowsHide: true });
    // Lines look like: "    DisableAutoUpdate    REG_DWORD    0x1"
    const match = stdout.split(/\r?\n/).find((line) => line.trim().startsWith(value));
    return match
      ? (match
          .trim()
          .split(/\s{2,}/)
          .pop() ?? null)
      : null;
  } catch {
    return null;
  }
}

/**
 * The managed-preference plists consulted on macOS, in precedence order. A profile scoped to the
 * computer lands at the top level; one scoped to a user (Jamf user-level scopes, user enrollment)
 * lands under that user's short name. Reading the composed domain (`defaults read app.getjetstream`)
 * would find either, but it would also pick up the user's own unmanaged ~/Library/Preferences plist,
 * and a user must not be able to mark their own install as managed.
 */
export function getMacOsManagedPreferenceDomains(username: string): string[] {
  return [
    path.posix.join(MACOS_MANAGED_PREFERENCES_DIR, MACOS_PREFERENCE_DOMAIN),
    path.posix.join(MACOS_MANAGED_PREFERENCES_DIR, username, MACOS_PREFERENCE_DOMAIN),
  ];
}

async function readMacOsManagedPreference(): Promise<string | null> {
  if (process.platform !== 'darwin') {
    return null;
  }
  for (const domain of getMacOsManagedPreferenceDomains(os.userInfo().username)) {
    try {
      const { stdout } = await execFileAsync('defaults', ['read', domain, POLICY_KEY]);
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // `defaults` exits non-zero when the plist or key is absent - the normal answer on an
      // unmanaged machine - so fall through to the next location.
    }
  }
  return null;
}

/** The policy file's only recognized shape is `{ "DisableAutoUpdate": <value> }`; anything else reads as "not set". */
export function parseManagedPolicyFile(contents: unknown): boolean | null {
  if (typeof contents !== 'object' || contents === null) {
    return null;
  }
  const value = (contents as Record<string, unknown>)[POLICY_KEY];
  return typeof value === 'undefined' ? null : toBoolean(value);
}

/**
 * Owners that prove a Windows policy file was placed by an administrator: SYSTEM (MDM/GPO delivery)
 * and the built-in Administrators group (an elevated process takes it as the owner of what it creates).
 * Compared as SIDs so the check holds on localized Windows, where the group names differ.
 */
const WINDOWS_ADMINISTRATIVE_OWNER_SIDS = new Set(['S-1-5-18', 'S-1-5-32-544']);

export function isWindowsPolicyFileOwnerTrusted(ownerSid: unknown): boolean {
  return typeof ownerSid === 'string' && WINDOWS_ADMINISTRATIVE_OWNER_SIDS.has(ownerSid.trim().toUpperCase());
}

/** One entry of a Windows DACL as PowerShell reports it: the principal, allow or deny, and the access mask */
export interface WindowsAccessRule {
  sid: string;
  type: string;
  /**
   * The raw access mask (`[int]$rule.FileSystemRights`), never the enum's display names: those have
   * aliases (`WriteData`/`CreateFiles`, `AppendData`/`CreateDirectories`) and .NET does not say which
   * one it prints, so a name match could miss a write grant. Generic rights arrive as negative int32s.
   */
  rights: number;
}

/**
 * Principals that stand for "any user of this machine": the well-known groups every account belongs
 * to, and the logon classes (console, network, remote desktop, …) a standard user's token picks up
 * from the way they signed in. An Allow rule for one of them carrying a right that changes or
 * replaces the policy means a standard user can rewrite it however the file is owned. Named accounts
 * (S-1-5-21-…) are deliberately not judged: telling an administrator's account from a standard one
 * needs a group lookup, and an administrator who grants one named account write access has made
 * that choice on purpose.
 */
const WINDOWS_BROAD_PRINCIPAL_SIDS = new Set([
  'S-1-1-0', // Everyone
  'S-1-5-11', // Authenticated Users
  'S-1-5-32-545', // Users
  'S-1-5-32-546', // Guests
  'S-1-5-7', // Anonymous
  'S-1-5-15', // This Organization (every account authenticated by the domain)
  'S-1-2-0', // Local (signed in at the console)
  'S-1-2-1', // Console Logon
  'S-1-5-4', // Interactive
  'S-1-5-2', // Network
  'S-1-5-13', // Terminal Server User
  'S-1-5-14', // Remote Interactive Logon
]);

// Win32 file access-mask bits (winnt.h). `FullControl` and `Modify` are combinations of these.
const FILE_WRITE_DATA = 0x2; // also FILE_ADD_FILE on a folder
const FILE_APPEND_DATA = 0x4; // also FILE_ADD_SUBDIRECTORY on a folder
const FILE_DELETE_CHILD = 0x40;
const DELETE = 0x10000;
const WRITE_DAC = 0x40000; // ChangePermissions
const WRITE_OWNER = 0x80000; // TakeOwnership
const GENERIC_ALL = 0x10000000;
const GENERIC_WRITE = 0x40000000;

/** Bits on the FILE that let its contents be changed or the file be replaced */
const WINDOWS_FILE_WRITE_MASK = FILE_WRITE_DATA | FILE_APPEND_DATA | DELETE | WRITE_DAC | WRITE_OWNER | GENERIC_ALL | GENERIC_WRITE;
/**
 * Bits on the FOLDER that let the administrator's file be removed or swapped. Creating files and
 * subfolders is not among them: the default %ProgramData% ACL grants that to every user, and it
 * cannot replace a file that already exists or delete one the user does not own.
 */
const WINDOWS_FOLDER_REPLACE_MASK = FILE_DELETE_CHILD | DELETE | WRITE_DAC | WRITE_OWNER | GENERIC_ALL;

function isWritableByBroadPrincipal(rules: WindowsAccessRule[], mask: number): boolean {
  return rules.some(
    ({ sid, type, rights }) =>
      type === 'Allow' && WINDOWS_BROAD_PRINCIPAL_SIDS.has(sid.trim().toUpperCase()) && ((rights >>> 0) & mask) !== 0,
  );
}

export interface WindowsPolicyFileLocation {
  fileOwner: unknown;
  dirOwner: unknown;
  fileRules: WindowsAccessRule[];
  dirRules: WindowsAccessRule[];
}

/**
 * The file AND the folder holding it must both belong to an administrator, and neither may grant
 * every user the right to change or replace it. Ownership of the file alone is not enough: a
 * standard user who owns the folder can swap entries in it between the check and the read, and an
 * administrator-owned file whose ACL lets Users modify it is no more protected than one they own.
 * With both owned by an administrator and no such grants, the default ACLs give a standard user no
 * delete, rename or write rights over the administrator's file, so the contents read alongside the
 * check are the contents that were checked.
 *
 * An empty rule list is rejected rather than passed: a file or folder under %ProgramData% always
 * carries inherited entries, so no entries means the ACL could not be read or is a NULL DACL, which
 * grants everyone full access while reporting no rules at all.
 */
export function isWindowsPolicyFileLocationTrusted(location: WindowsPolicyFileLocation): boolean {
  return (
    isWindowsPolicyFileOwnerTrusted(location.fileOwner) &&
    isWindowsPolicyFileOwnerTrusted(location.dirOwner) &&
    location.fileRules.length > 0 &&
    location.dirRules.length > 0 &&
    !isWritableByBroadPrincipal(location.fileRules, WINDOWS_FILE_WRITE_MASK) &&
    !isWritableByBroadPrincipal(location.dirRules, WINDOWS_FOLDER_REPLACE_MASK)
  );
}

function toRuleList(value: unknown): WindowsAccessRule[] {
  // ConvertTo-Json unwraps a single-element array into the element itself
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((rule) => {
    const rights = Number((rule as Partial<WindowsAccessRule>)?.rights);
    return {
      sid: String((rule as Partial<WindowsAccessRule>)?.sid ?? ''),
      type: String((rule as Partial<WindowsAccessRule>)?.type ?? ''),
      // A mask that did not arrive as a number is treated as every bit set, so the entry fails closed
      rights: Number.isFinite(rights) ? rights : -1,
    };
  });
}

/**
 * Reads the policy file together with the owner SIDs and access rules of the file and of its
 * folder, in one PowerShell invocation, or null when any of it cannot be read. Node's `stat` reports
 * no owner or ACL on Windows, so PowerShell resolves them. The path is embedded as a single-quoted
 * PowerShell literal, in which only a quote character is special (and is doubled), and passed to
 * `execFile` - never through a shell.
 */
async function readWindowsPolicyFile(filePath: string): Promise<(WindowsPolicyFileLocation & { contents: string }) | null> {
  try {
    const pathLiteral = filePath.replace(/'/g, "''");
    const script = [
      `$path = '${pathLiteral}'`,
      `$sidType = [System.Security.Principal.SecurityIdentifier]`,
      `$rules = { param($acl) @($acl.GetAccessRules($true, $true, $sidType) | ForEach-Object { @{ sid = $_.IdentityReference.Value; type = $_.AccessControlType.ToString(); rights = [int]$_.FileSystemRights } }) }`,
      `$fileAcl = Get-Acl -LiteralPath $path`,
      `$dirAcl = Get-Acl -LiteralPath (Split-Path -LiteralPath $path -Parent)`,
      `@{ fileOwner = $fileAcl.GetOwner($sidType).Value; dirOwner = $dirAcl.GetOwner($sidType).Value; fileRules = (& $rules $fileAcl); dirRules = (& $rules $dirAcl); contents = [System.IO.File]::ReadAllText($path) } | ConvertTo-Json -Compress -Depth 4`,
    ].join('; ');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    const parsed = JSON.parse(stdout) as {
      fileOwner?: unknown;
      dirOwner?: unknown;
      fileRules?: unknown;
      dirRules?: unknown;
      contents?: unknown;
    };
    if (typeof parsed.fileOwner !== 'string' || typeof parsed.dirOwner !== 'string' || typeof parsed.contents !== 'string') {
      return null;
    }
    return {
      fileOwner: parsed.fileOwner,
      dirOwner: parsed.dirOwner,
      fileRules: toRuleList(parsed.fileRules),
      dirRules: toRuleList(parsed.dirRules),
      contents: parsed.contents,
    };
  } catch {
    return null;
  }
}

/**
 * On Windows the file is only honored when an administrator put it there. The default ACL on
 * %ProgramData% lets any standard user create a `Jetstream` subfolder and a `policy.json` inside it,
 * which would otherwise let one unprivileged user of a shared machine switch updates off (or on) for
 * everyone else - the documentation promises that users cannot mark their own install as managed.
 * macOS and Linux need no check: the directories the file lives in are root-owned and not writable
 * without administrator rights.
 */
async function readManagedPolicyFile(): Promise<boolean | null> {
  const filePath = managedPolicyFilePath();
  try {
    if (process.platform !== 'win32') {
      return parseManagedPolicyFile(JSON.parse(await readFile(filePath, 'utf-8')));
    }
    // A missing file is the normal case on an unmanaged machine; only spawn PowerShell when it exists.
    // Nothing is read here - the file is untrusted until its location has been checked.
    await stat(filePath);
    const policyFile = await readWindowsPolicyFile(filePath);
    if (!policyFile) {
      logger.warn(`Ignoring update policy file ${filePath}: its contents or ownership could not be read`);
      return null;
    }
    if (!isWindowsPolicyFileLocationTrusted(policyFile)) {
      logger.warn(
        `Ignoring update policy file ${filePath}: the file and its folder must both be owned by an administrator or SYSTEM and not grant every user write access (file owner ${policyFile.fileOwner}, folder owner ${policyFile.dirOwner})`,
      );
      return null;
    }
    return parseManagedPolicyFile(JSON.parse(policyFile.contents));
  } catch {
    return null;
  }
}

/**
 * Every policy channel carries a different flavor of truthy — a REG_DWORD arrives as "0x1", a
 * configuration profile as "1", an env var as whatever the admin typed. Anything unrecognized is
 * treated as "not set" so a typo can never accidentally disable updates.
 */
export function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', '0x1'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', '0x0'].includes(normalized)) {
      return false;
    }
  }
  return null;
}

/**
 * The administrator-controlled inputs. These cannot change while the app is running, so they are
 * read once at startup and reused whenever the policy is re-resolved.
 */
export interface UpdatePolicyEnvironment {
  /** `--disable-auto-update` was passed on the command line. */
  disabledByCommandLine: boolean;
  /** JETSTREAM_DISABLE_AUTO_UPDATE resolved to a boolean, or null when unset/unparseable. */
  disabledByEnvironment: boolean | null;
  /** Registry / configuration profile / policy file, or null when no channel had an opinion. */
  disabledByManagedPolicy: boolean | null;
  perMachineInstall: boolean;
  /** Running from the portable (no-install) Windows build. */
  isPortableBuild: boolean;
}

/**
 * Pure resolution of the layered configuration, highest precedence first: command line, then
 * environment, then administrator policy, then the user's own preference.
 */
export function resolveUpdatePolicy(environment: UpdatePolicyEnvironment, userPreferenceEnabled: boolean): UpdatePolicy {
  const { perMachineInstall } = environment;

  // The portable build has nothing to update - the only artifact published for a release is the
  // NSIS installer, so "updating" would silently turn a portable copy into an installed one,
  // defeating the entire reason someone chose it. It outranks every other source because no
  // configuration can make a self-update work here.
  if (environment.isPortableBuild) {
    return {
      autoUpdateEnabled: false,
      allowManualCheck: false,
      source: 'portable',
      managed: true,
      perMachineInstall: false,
    };
  }

  const managedDecision = ((): { disabled: boolean; source: UpdatePolicySource } | null => {
    if (environment.disabledByCommandLine) {
      return { disabled: true, source: 'command-line' };
    }
    if (environment.disabledByEnvironment !== null) {
      return { disabled: environment.disabledByEnvironment, source: 'environment' };
    }
    if (environment.disabledByManagedPolicy !== null) {
      return { disabled: environment.disabledByManagedPolicy, source: 'managed-policy' };
    }
    return null;
  })();

  if (managedDecision?.disabled) {
    // An administrator turned updates off, which means they are delivering them some other way
    // (MDM, an imaging pipeline). A manual check would only re-download something the user cannot
    // install, so the "Check for Updates" affordance goes away entirely.
    return {
      autoUpdateEnabled: false,
      allowManualCheck: false,
      source: managedDecision.source,
      managed: true,
      perMachineInstall,
    };
  }

  if (!managedDecision && !userPreferenceEnabled) {
    // The user opted out of *automatic* updates, not out of updating - a manual check still works.
    return {
      autoUpdateEnabled: false,
      allowManualCheck: true,
      source: 'user-preference',
      managed: false,
      perMachineInstall,
    };
  }

  // A policy that explicitly *enables* updates (`DisableAutoUpdate = 0`) is an administrator
  // pinning them on, so it overrides the user's opt-out just as the disabling form overrides
  // their opt-in - the in-app toggle goes read-only either way.
  return {
    autoUpdateEnabled: true,
    allowManualCheck: true,
    source: managedDecision ? managedDecision.source : 'default',
    managed: !!managedDecision,
    perMachineInstall,
  };
}

/**
 * Detect a Windows all-users install. The assisted NSIS installer records where it put the app, in
 * HKLM for a per-machine install and HKCU for a per-user one, and reads those keys back on the next
 * run to decide which mode to upgrade in. The mere presence of the HKLM value makes every silent
 * upgrade elevate (app-builder-lib `templates/nsis/installer.nsi`), so that is exactly what we
 * check — a leftover key from a since-removed all-users install counts, because NSIS counts it too.
 */
async function detectPerMachineInstall(): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }
  const installLocation = await readWindowsRegistryValue(`HKLM\\SOFTWARE\\${computeNsisAppGuid(APP_ID)}`, 'InstallLocation');
  return !!installLocation;
}

export async function readUpdatePolicyEnvironment(): Promise<UpdatePolicyEnvironment> {
  const [registryValue, managedPreference, policyFileValue, perMachineInstall] = await Promise.all([
    readWindowsRegistryValue(WINDOWS_POLICY_KEY, POLICY_KEY),
    readMacOsManagedPreference(),
    readManagedPolicyFile(),
    detectPerMachineInstall(),
  ]);

  const disabledByManagedPolicy = toBoolean(registryValue) ?? toBoolean(managedPreference) ?? policyFileValue;

  return {
    disabledByCommandLine: process.argv.slice(1).includes(CLI_FLAG),
    disabledByEnvironment: toBoolean(process.env[ENV_VAR]),
    disabledByManagedPolicy,
    perMachineInstall,
    // electron-builder's portable target sets this for the app it unpacks and launches; it is the
    // only signal distinguishing a portable run from an installed one (electron-updater itself has
    // no portable detection - isUpdaterActive() only checks app.isPackaged, which is true here).
    isPortableBuild: !!process.env.PORTABLE_EXECUTABLE_DIR,
  };
}

let cachedEnvironment: UpdatePolicyEnvironment | null = null;

/**
 * Resolve the effective policy. The administrator layers are read from disk once per process; only
 * the user preference is re-read, so toggling the in-app setting is cheap.
 */
export async function loadUpdatePolicy(userPreferenceEnabled: boolean): Promise<UpdatePolicy> {
  if (!cachedEnvironment) {
    cachedEnvironment = await readUpdatePolicyEnvironment();
    logger.info('Update policy environment:', cachedEnvironment);
  }
  return resolveUpdatePolicy(cachedEnvironment, userPreferenceEnabled);
}
