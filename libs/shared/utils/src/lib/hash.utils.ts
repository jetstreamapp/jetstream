/**
 * SHA-1 hex digest of a string.
 *
 * Used wherever an identifier has to be embedded in a name that is visible outside the app
 * (IndexedDB database and object store names) or sent to the sync service, so the raw value —
 * which may be a user id, email, or Salesforce username — is never exposed verbatim.
 *
 * Not a security primitive: this is about not leaking identifiers in plain sight, not about
 * resisting a preimage attack on a value the caller already possesses.
 */
export async function sha1Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Length of the hashed user id in a data history scope directory name. Full SHA-1 is unnecessarily
 * long for a folder users may browse (native/FSA backends), and 16 hex chars is far past collision
 * risk for the number of accounts that ever share one machine.
 */
const DATA_HISTORY_USER_SCOPE_HASH_LENGTH = 16;

/**
 * Per-user directory name every Data History file backend roots its tree under
 * (`u-<first 16 hex of sha1(userId)>`), so accounts sharing a machine never see or sweep each
 * other's files.
 *
 * Lives here, in a dependency-light lib, because it has TWO consumers that must never drift: the
 * renderer (`@jetstream/ui/data-history`, which scopes its OPFS/FSA/native stores) and the Electron
 * main process, which derives the directory from the authenticated user ITSELF rather than trusting
 * the name the renderer sends over IPC.
 *
 * The user id is hashed rather than used verbatim, matching `getScopedDexieDbName` — on canvas the
 * scope id is a Salesforce username, which is email-shaped and does not belong in a folder name.
 */
export async function getDataHistoryUserScopeDirName(userId: string): Promise<string> {
  if (!userId) {
    throw new Error('A user id is required to scope data history storage');
  }
  return `u-${(await sha1Hex(userId)).slice(0, DATA_HISTORY_USER_SCOPE_HASH_LENGTH)}`;
}
