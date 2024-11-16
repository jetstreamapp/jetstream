import {
  checkUserAgentSimilarity,
  createCSRFToken,
  createHash,
  getCookieConfig,
  hashPassword,
  randomString,
  validateCSRFToken,
  verifyPassword,
} from '../auth.utils';

describe('getCookieConfig', () => {
  it('should return correct cookie config for secure cookies', () => {
    const config = getCookieConfig(true);
    expect(config.callbackUrl.name).toBe('__Secure-jetstream-auth.callback-url');
    expect(config.callbackUrl.options.secure).toBe(true);
  });

  it('should return correct cookie config for non-secure cookies', () => {
    const config = getCookieConfig(false);
    expect(config.callbackUrl.name).toBe('jetstream-auth.callback-url');
    expect(config.callbackUrl.options.secure).toBe(false);
  });
});

describe('hashPassword', () => {
  it('should hash the password correctly', async () => {
    const password = 'testPassword';
    const hashedPassword = await hashPassword(password);
    expect(hashedPassword).not.toBe(password);
  });
});

describe('verifyPassword', () => {
  it('should verify the password correctly', async () => {
    const password = 'testPassword';
    const hashedPassword = await hashPassword(password);
    const isMatch = await verifyPassword(password, hashedPassword);
    expect(isMatch).toBe(true);
  });

  it('should return false for incorrect password', async () => {
    const password = 'testPassword';
    const hashedPassword = await hashPassword(password);
    const isMatch = await verifyPassword('wrongPassword', hashedPassword);
    expect(isMatch).toBe(false);
  });
});

describe('createHash', () => {
  it('should create a correct hash', async () => {
    const message = 'testMessage';
    const hash = await createHash(message);
    expect(hash).toHaveLength(64);
  });
});

describe('randomString', () => {
  it('should create a random string of specified length', () => {
    const size = 16;
    const randomStr = randomString(size);
    expect(randomStr).toHaveLength(size * 2); // Each byte is represented by 2 hex characters
  });
});

describe('createCSRFToken', () => {
  it('should create a CSRF token and cookie', async () => {
    const secret = 'testSecret';
    const { cookie, csrfToken } = await createCSRFToken({ secret });
    expect(cookie).toContain(csrfToken);
  });
});

describe('validateCSRFToken', () => {
  it('should validate the CSRF token correctly', async () => {
    const secret = 'testSecret';
    const { cookie, csrfToken } = await createCSRFToken({ secret });
    const isValid = await validateCSRFToken({ secret, cookieValue: cookie, bodyValue: csrfToken });
    expect(isValid).toBe(true);
  });

  it('should return false for invalid CSRF token', async () => {
    const secret = 'testSecret';
    const { cookie } = await createCSRFToken({ secret });
    const isValid = await validateCSRFToken({ secret, cookieValue: cookie, bodyValue: 'wrongToken' });
    expect(isValid).toBe(false);
  });
});

describe('isValidUserAgent', () => {
  it('should return true for matching user agents', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(true);
  });

  it('should return false for different browsers', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/89.0';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return false for different OS', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return false for lower browser versions', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4515.107 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return true for higher browser versions', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(true);
  });
});

describe('isValidUserAgent', () => {
  it('should return true for matching user agents', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(true);
  });

  it('should return false for different browsers', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/89.0';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return false for different OS', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return false for lower browser versions', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4515.107 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(false);
  });

  it('should return true for higher browser versions', () => {
    const sessionUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const currentUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36';

    expect(checkUserAgentSimilarity(sessionUserAgent, currentUserAgent)).toBe(true);
  });
});
