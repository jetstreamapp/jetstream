import { createHmac, timingSafeEqual } from 'crypto';

/**
 * TOTP (RFC 6238), the HOTP primitive it is built on (RFC 4226), and the base32 codec that the
 * otpauth:// URI format requires.
 *
 * Implemented here rather than pulled from a dependency because the `@oslojs/*` packages this
 * replaces were deprecated upstream. Nothing about this surface justifies adopting another
 * dependency to replace them: node's crypto module supplies both the HMAC and the constant-time
 * comparison, and correctness is pinned by the published RFC test vectors in the co-located spec.
 *
 * Should a library ever be reconsidered, it needs a grace period expressed in seconds rather than
 * the step-based `window` option common to TOTP libraries, so that TOTP_GRACE_PERIOD_SEC (see
 * auth.service) stays tunable independently of the step size.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes an RFC 4648 base32 string, tolerating but not requiring `=` padding.
 *
 * Accepts either case, and rejects anything that is not a well-formed encoding: unknown characters,
 * a character count that cannot terminate a group, or non-zero trailing bits.
 */
export function decodeBase32IgnorePadding(value: string): Buffer {
  const bytes: number[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const characterValue = BASE32_ALPHABET.indexOf(character);
    if (characterValue === -1) {
      throw new Error(`Invalid base32 character: ${character}`);
    }
    buffer = (buffer << 5) | characterValue;
    bitsInBuffer += 5;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes.push((buffer >> bitsInBuffer) & 0xff);
    }
  }

  // A complete encoding leaves fewer than 5 unread bits, all of which the encoder zeroed as
  // padding. Anything else means the input was truncated or corrupted.
  if (bitsInBuffer >= 5) {
    throw new Error('Invalid base32 string: incomplete character group');
  }
  if ((buffer & ((1 << bitsInBuffer) - 1)) !== 0) {
    throw new Error('Invalid base32 string: trailing bits must be zero');
  }

  return Buffer.from(bytes);
}

/** Encodes bytes as RFC 4648 base32 with no `=` padding, the form authenticator apps expect. */
export function encodeBase32NoPadding(bytes: Uint8Array): string {
  let result = '';
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      result += BASE32_ALPHABET[(buffer >> bitsInBuffer) & 0x1f];
    }
  }

  if (bitsInBuffer > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bitsInBuffer)) & 0x1f];
  }

  return result;
}

function counterForTime(unixMilliseconds: number, intervalSeconds: number): bigint {
  return BigInt(Math.floor(unixMilliseconds / (intervalSeconds * 1000)));
}

/**
 * RFC 4226 HOTP. Digits are limited to 6-8 because dynamic truncation produces a 31-bit value,
 * which only distributes evenly across code lengths in that range.
 */
function generateHOTP(key: Uint8Array, counter: bigint, digits: number): string {
  if (digits < 6 || digits > 8) {
    throw new TypeError('Digits must be between 6 and 8');
  }

  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', key).update(counterBytes).digest();

  // Dynamic truncation (RFC 4226 section 5.3): the low nibble of the final byte selects a 4-byte
  // window, whose high bit is cleared so the value is unsigned on every platform.
  const offset = digest[digest.length - 1] & 0x0f;
  const truncated = digest.readUInt32BE(offset) & 0x7fffffff;

  return (truncated % 10 ** digits).toString().padStart(digits, '0');
}

/** RFC 6238 TOTP for the current time. */
export function generateTOTP(key: Uint8Array, intervalSeconds: number, digits: number): string {
  return generateHOTP(key, counterForTime(Date.now(), intervalSeconds), digits);
}

/**
 * Verifies a TOTP code, accepting any code valid within `gracePeriodSeconds` on either side of now
 * so that modest clock skew between the server and the user's device does not reject a good code.
 */
export function verifyTOTPWithGracePeriod(
  key: Uint8Array,
  intervalSeconds: number,
  digits: number,
  otp: string,
  gracePeriodSeconds: number,
): boolean {
  if (gracePeriodSeconds < 0) {
    throw new TypeError('Grace period must be a positive number');
  }

  // Compared as bytes rather than characters: timingSafeEqual throws on a length mismatch, and a
  // multi-byte character would make the two counts disagree.
  const otpBytes = Buffer.from(otp, 'utf8');
  if (otpBytes.length !== digits) {
    return false;
  }

  const now = Date.now();
  const graceMilliseconds = gracePeriodSeconds * 1000;
  const lastCounter = counterForTime(now + graceMilliseconds, intervalSeconds);

  let isValid = false;
  // Every candidate is checked even after one matches, so verification takes the same amount of
  // time regardless of which window (if any) the code came from.
  for (let counter = counterForTime(now - graceMilliseconds, intervalSeconds); counter <= lastCounter; counter++) {
    if (timingSafeEqual(Buffer.from(generateHOTP(key, counter, digits), 'utf8'), otpBytes)) {
      isValid = true;
    }
  }

  return isValid;
}

/**
 * Builds the otpauth:// URI that authenticator apps consume, normally by scanning a QR code.
 * @see https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */
export function createTOTPKeyURI(issuer: string, accountName: string, key: Uint8Array, periodSeconds: number, digits: number): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  // Assembled by hand rather than with URLSearchParams: the Key-Uri-Format expects percent-encoding
  // throughout, but URLSearchParams form-encodes spaces as '+', which authenticator apps decode
  // inconsistently.
  const params = [
    `issuer=${encodeURIComponent(issuer)}`,
    'algorithm=SHA1',
    `secret=${encodeBase32NoPadding(key)}`,
    `period=${periodSeconds}`,
    `digits=${digits}`,
  ].join('&');
  return `otpauth://totp/${label}?${params}`;
}
