import { randomBytes } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTOTPKeyURI, decodeBase32IgnorePadding, encodeBase32NoPadding, generateTOTP, verifyTOTPWithGracePeriod } from '../totp.util';

// The shared secret used by every published test vector in RFC 4226 and RFC 6238.
const RFC_TEST_KEY = Buffer.from('12345678901234567890', 'ascii');
const INTERVAL_SEC = 30;

describe('totp.util', () => {
  describe('base32', () => {
    // RFC 4648 section 10, with the trailing '=' padding removed.
    const RFC_4648_VECTORS: [input: string, encoded: string][] = [
      ['', ''],
      ['f', 'MY'],
      ['fo', 'MZXQ'],
      ['foo', 'MZXW6'],
      ['foob', 'MZXW6YQ'],
      ['fooba', 'MZXW6YTB'],
      ['foobar', 'MZXW6YTBOI'],
    ];

    it.each(RFC_4648_VECTORS)('encodes %j as %j', (input, encoded) => {
      expect(encodeBase32NoPadding(Buffer.from(input, 'ascii'))).toBe(encoded);
    });

    it.each(RFC_4648_VECTORS)('decodes the encoding of %j back to the original bytes', (input) => {
      expect(decodeBase32IgnorePadding(encodeBase32NoPadding(Buffer.from(input, 'ascii'))).toString('ascii')).toBe(input);
    });

    it('decodes padded input', () => {
      expect(decodeBase32IgnorePadding('MZXW6YTBOI======').toString('ascii')).toBe('foobar');
    });

    it('decodes lowercase input', () => {
      expect(decodeBase32IgnorePadding('mzxw6ytboi').toString('ascii')).toBe('foobar');
    });

    it('rejects characters outside the alphabet', () => {
      expect(() => decodeBase32IgnorePadding('MZXW6YT1')).toThrow(/Invalid base32 character/);
    });

    it('rejects a character count that cannot terminate a group', () => {
      expect(() => decodeBase32IgnorePadding('MZXW6YTBO')).toThrow(/incomplete character group/);
    });

    it('rejects non-zero trailing bits', () => {
      // 'f' encodes to 'MY', whose last character carries 2 unused bits. 'MZ' decodes to the same
      // byte but leaves those bits set, so it is not an encoding any encoder would produce.
      expect(decodeBase32IgnorePadding('MY').toString('ascii')).toBe('f');
      expect(() => decodeBase32IgnorePadding('MZ')).toThrow(/trailing bits must be zero/);
    });
  });

  describe('generateTOTP', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // RFC 6238 Appendix B, SHA-1 rows. Truncated to the low 6 digits, which is what a 6-digit
    // code is by definition (the value is taken modulo 10^digits).
    const RFC_6238_VECTORS: [unixSeconds: number, eightDigitCode: string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];

    it.each(RFC_6238_VECTORS)('matches the RFC 6238 vector at T=%i', (unixSeconds, eightDigitCode) => {
      vi.setSystemTime(unixSeconds * 1000);
      expect(generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 8)).toBe(eightDigitCode);
      expect(generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 6)).toBe(eightDigitCode.slice(-6));
    });

    // RFC 4226 Appendix D. TOTP at time counter*interval is HOTP at that counter, so the HOTP
    // vectors exercise the underlying truncation as well.
    const RFC_4226_VECTORS = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

    it.each(RFC_4226_VECTORS.map((code, counter): [number, string] => [counter, code]))(
      'matches the RFC 4226 HOTP vector at counter %i',
      (counter, code) => {
        vi.setSystemTime(counter * INTERVAL_SEC * 1000);
        expect(generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 6)).toBe(code);
      },
    );

    it('rejects a digit count outside 6-8', () => {
      vi.setSystemTime(0);
      expect(() => generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 5)).toThrow(/between 6 and 8/);
      expect(() => generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 9)).toThrow(/between 6 and 8/);
    });
  });

  describe('verifyTOTPWithGracePeriod', () => {
    const GRACE_SEC = 15;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Seconds since epoch, positioned `offsetIntoWindow` seconds into the window at `counter`. */
    const timeAt = (counter: number, offsetIntoWindow: number) => (counter * INTERVAL_SEC + offsetIntoWindow) * 1000;

    const codeAt = (counter: number) => {
      vi.setSystemTime(timeAt(counter, 0));
      return generateTOTP(RFC_TEST_KEY, INTERVAL_SEC, 6);
    };

    it('accepts the code for the current window', () => {
      const code = codeAt(100);
      vi.setSystemTime(timeAt(100, 20));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, code, GRACE_SEC)).toBe(true);
    });

    it('accepts the previous code while still inside the grace period', () => {
      const code = codeAt(99);
      vi.setSystemTime(timeAt(100, 10));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, code, GRACE_SEC)).toBe(true);
    });

    it('rejects the previous code once the grace period has passed', () => {
      const code = codeAt(99);
      vi.setSystemTime(timeAt(100, 20));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, code, GRACE_SEC)).toBe(false);
    });

    it('accepts the next code early, for a device running slightly fast', () => {
      const code = codeAt(101);
      vi.setSystemTime(timeAt(100, 20));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, code, GRACE_SEC)).toBe(true);
    });

    // The reason the grace period is kept below half a step: a wider one would leave three codes
    // simultaneously valid, tripling the window an attacker gets to guess within.
    it('never accepts the previous and next codes at the same instant', () => {
      const previous = codeAt(99);
      const next = codeAt(101);
      for (let offsetIntoWindow = 0; offsetIntoWindow < INTERVAL_SEC; offsetIntoWindow++) {
        vi.setSystemTime(timeAt(100, offsetIntoWindow));
        const previousAccepted = verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, previous, GRACE_SEC);
        const nextAccepted = verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, next, GRACE_SEC);
        expect(previousAccepted && nextAccepted).toBe(false);
      }
    });

    it('rejects an unrelated code', () => {
      vi.setSystemTime(timeAt(100, 5));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '000000', GRACE_SEC)).toBe(false);
    });

    it('rejects a code of the wrong length instead of throwing', () => {
      vi.setSystemTime(timeAt(100, 5));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '12345', GRACE_SEC)).toBe(false);
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '1234567', GRACE_SEC)).toBe(false);
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '', GRACE_SEC)).toBe(false);
    });

    it('rejects a multi-byte code of the right character length instead of throwing', () => {
      vi.setSystemTime(timeAt(100, 5));
      expect(verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '12345é', GRACE_SEC)).toBe(false);
    });

    it('rejects a negative grace period', () => {
      vi.setSystemTime(timeAt(100, 5));
      expect(() => verifyTOTPWithGracePeriod(RFC_TEST_KEY, INTERVAL_SEC, 6, '000000', -1)).toThrow(/positive number/);
    });
  });

  describe('createTOTPKeyURI', () => {
    it('builds a scannable otpauth URI', () => {
      expect(createTOTPKeyURI('jetstream', 'user@example.com', RFC_TEST_KEY, 30, 6)).toBe(
        'otpauth://totp/jetstream:user%40example.com' +
          '?issuer=jetstream&algorithm=SHA1&secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&period=30&digits=6',
      );
    });

    it('encodes a secret an authenticator can decode back to the original key', () => {
      const uri = new URL(createTOTPKeyURI('jetstream', 'user@example.com', RFC_TEST_KEY, 30, 6));
      const secret = uri.searchParams.get('secret')!;
      expect(decodeBase32IgnorePadding(secret).equals(RFC_TEST_KEY)).toBe(true);
    });

    it('escapes characters that would otherwise break the label', () => {
      const uri = createTOTPKeyURI('Jetstream / Dev', 'user+tag@example.com', RFC_TEST_KEY, 30, 6);
      expect(uri.startsWith('otpauth://totp/Jetstream%20%2F%20Dev:user%2Btag%40example.com?')).toBe(true);
    });

    it('percent-encodes spaces in the issuer param rather than form-encoding them as "+"', () => {
      const uri = createTOTPKeyURI('Jetstream Dev', 'user@example.com', RFC_TEST_KEY, 30, 6);
      expect(uri).toContain('issuer=Jetstream%20Dev');
    });
  });

  // Enrollment hands the key to the authenticator as base32 inside the URI but persists it as hex,
  // so the two representations have to agree or every code would verify against the wrong key.
  it('round-trips a generated secret from enrollment through verification', () => {
    for (let iteration = 0; iteration < 50; iteration++) {
      const storedSecretHex = randomBytes(20).toString('hex').toUpperCase();
      const key = Buffer.from(storedSecretHex, 'hex');

      const uri = new URL(createTOTPKeyURI('jetstream', 'user@example.com', key, INTERVAL_SEC, 6));
      const scannedSecret = uri.searchParams.get('secret')!;

      // What convertBase32ToHex does with the secret the client posts back during enrollment.
      expect(decodeBase32IgnorePadding(scannedSecret).toString('hex').toUpperCase()).toBe(storedSecretHex);

      const code = generateTOTP(decodeBase32IgnorePadding(scannedSecret), INTERVAL_SEC, 6);
      expect(verifyTOTPWithGracePeriod(key, INTERVAL_SEC, 6, code, 15)).toBe(true);
    }
  });
});
