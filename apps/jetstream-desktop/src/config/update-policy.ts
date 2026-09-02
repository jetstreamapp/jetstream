import type { UpdatePolicy, UpdatePolicySource } from '@jetstream/desktop/types';
import logger from 'electron-log';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

async function readManagedPolicyFile(): Promise<boolean | null> {
  try {
    return parseManagedPolicyFile(JSON.parse(await readFile(managedPolicyFilePath(), 'utf-8')));
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
}

/**
 * Pure resolution of the layered configuration, highest precedence first: command line, then
 * environment, then administrator policy, then the user's own preference.
 */
export function resolveUpdatePolicy(environment: UpdatePolicyEnvironment, userPreferenceEnabled: boolean): UpdatePolicy {
  const { perMachineInstall } = environment;

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
