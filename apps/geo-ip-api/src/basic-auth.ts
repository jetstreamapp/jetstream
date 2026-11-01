import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time credential comparison. Both values are hashed to a fixed-length digest first so the
 * comparison does not leak length and does not throw on mismatched lengths.
 */
function timingSafeStringCompare(providedValue: string, expectedValue: string): boolean {
  const providedHash = createHash('sha256').update(String(providedValue)).digest();
  const expectedHash = createHash('sha256').update(String(expectedValue)).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

/**
 * Whether an `Authorization` header carries the expected Basic credentials. Fails closed when the expected
 * credentials are not configured, so an empty `:` header can never match empty defaults.
 */
export function hasValidBasicAuthCredentials(
  authHeader: string | undefined,
  expectedUsername: string | undefined,
  expectedPassword: string | undefined,
): boolean {
  if (typeof authHeader !== 'string' || !expectedUsername || !expectedPassword) {
    return false;
  }
  const [type, token] = authHeader.split(' ');
  if (type !== 'Basic' || !token) {
    return false;
  }
  // Per RFC 7617 the userid cannot contain a colon but the password may, so split on the first colon only.
  const decodedCredentials = Buffer.from(token, 'base64').toString();
  const separatorIndex = decodedCredentials.indexOf(':');
  const username = separatorIndex === -1 ? decodedCredentials : decodedCredentials.slice(0, separatorIndex);
  const password = separatorIndex === -1 ? '' : decodedCredentials.slice(separatorIndex + 1);
  // Evaluate both comparisons (no short-circuit) with a constant-time compare so response time
  // does not reveal whether the username alone was correct.
  const usernameMatches = timingSafeStringCompare(username, expectedUsername);
  const passwordMatches = timingSafeStringCompare(password, expectedPassword);
  return usernameMatches && passwordMatches;
}
