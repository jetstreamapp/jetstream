import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

/**
 * Owners that prove a Windows policy file was placed by an administrator: SYSTEM (MDM/GPO delivery)
 * and the built-in Administrators group (an elevated process takes it as the owner of what it creates).
 * Compared as SIDs so the check holds on localized Windows, where the group names differ.
 */
const WINDOWS_ADMINISTRATIVE_OWNER_SIDS = new Set(['S-1-5-18', 'S-1-5-32-544']);

export function isWindowsPolicyFileOwnerTrusted(ownerSid: string): boolean {
  return WINDOWS_ADMINISTRATIVE_OWNER_SIDS.has(ownerSid.trim().toUpperCase());
}

/**
 * One entry of a Windows DACL as PowerShell reports it: the principal, allow or deny, and the access mask.
 *
 * `rights` is the raw access mask (`[int]$rule.FileSystemRights`), never the enum's display names: those
 * have aliases (`WriteData`/`CreateFiles`, `AppendData`/`CreateDirectories`) and .NET does not say which
 * one it prints, so a name match could miss a write grant. Generic rights arrive as negative int32s.
 */
const WindowsAccessRuleSchema = z.object({
  sid: z.string(),
  type: z.string(),
  rights: z.number(),
});

export type WindowsAccessRule = z.infer<typeof WindowsAccessRuleSchema>;

// ConvertTo-Json unwraps a single-element array into the element itself, and an empty pipeline into null
const WindowsAccessRuleListSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : value == null ? [] : [value]),
  z.array(WindowsAccessRuleSchema),
);

/**
 * The output of the PowerShell probe in `readWindowsPolicyFile`. Anything that does not match - a
 * missing owner, a mask that is not a number - means the location cannot be judged, so the file is ignored.
 */
const WindowsPolicyFileProbeSchema = z.object({
  fileOwner: z.string(),
  dirOwner: z.string(),
  fileRules: WindowsAccessRuleListSchema,
  dirRules: WindowsAccessRuleListSchema,
  contents: z.string(),
});

export type WindowsPolicyFileProbe = z.infer<typeof WindowsPolicyFileProbeSchema>;

export type WindowsPolicyFileLocation = Omit<WindowsPolicyFileProbe, 'contents'>;

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

export function parseWindowsPolicyFileProbe(output: unknown): WindowsPolicyFileProbe | null {
  const results = WindowsPolicyFileProbeSchema.safeParse(output);
  return results.success ? results.data : null;
}

/**
 * Reads the policy file together with the owner SIDs and access rules of the file and of its
 * folder, in one PowerShell invocation, or null when any of it cannot be read. Node's `stat` reports
 * no owner or ACL on Windows, so PowerShell resolves them. The path is embedded as a single-quoted
 * PowerShell literal, in which only a quote character is special (and is doubled), and passed to
 * `execFile` - never through a shell.
 */
export async function readWindowsPolicyFile(filePath: string): Promise<WindowsPolicyFileProbe | null> {
  try {
    const pathLiteral = filePath.replace(/'/g, "''");
    const script = [
      `$path = '${pathLiteral}'`,
      `$sidType = [System.Security.Principal.SecurityIdentifier]`,
      `$rules = { param($acl) @($acl.GetAccessRules($true, $true, $sidType) | ForEach-Object { @{ sid = $_.IdentityReference.Value; type = $_.AccessControlType.ToString(); rights = [int]$_.FileSystemRights } }) }`,
      `$fileAcl = Get-Acl -LiteralPath $path`,
      // `Split-Path -LiteralPath` cannot be combined with `-Parent` (they are in different parameter sets)
      `$dirAcl = Get-Acl -LiteralPath ([System.IO.Path]::GetDirectoryName($path))`,
      `@{ fileOwner = $fileAcl.GetOwner($sidType).Value; dirOwner = $dirAcl.GetOwner($sidType).Value; fileRules = (& $rules $fileAcl); dirRules = (& $rules $dirAcl); contents = [System.IO.File]::ReadAllText($path) } | ConvertTo-Json -Compress -Depth 4`,
    ].join('; ');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    return parseWindowsPolicyFileProbe(JSON.parse(stdout));
  } catch {
    return null;
  }
}
