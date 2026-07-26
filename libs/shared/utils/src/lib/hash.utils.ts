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
