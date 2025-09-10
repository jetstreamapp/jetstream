import {
  checkUserAgentSimilarity,
  createCSRFToken,
  createHMAC,
  generateHMACDoubleCSRFToken,
  getCookieConfig,
  hashPassword,
  randomString,
  validateCSRFToken,
  validateHMACDoubleCSRFToken,
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
    const hash = createHMAC('test', message);
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
  it('should create a CSRF token and cookie', () => {
    const secret = 'testSecret';
    const { cookie, csrfToken } = createCSRFToken({ secret });
    expect(cookie).toContain(csrfToken);
  });
});

describe('validateCSRFToken', () => {
  it('should validate the CSRF token correctly', () => {
    const secret = 'testSecret';
    const { cookie, csrfToken } = createCSRFToken({ secret });
    const isValid = validateCSRFToken({ secret, cookieValue: cookie, bodyValue: csrfToken });
    expect(isValid).toBe(true);
  });

  it('should return false for invalid CSRF token', () => {
    const secret = 'testSecret';
    const { cookie } = createCSRFToken({ secret });
    const isValid = validateCSRFToken({ secret, cookieValue: cookie, bodyValue: 'wrongToken' });
    expect(isValid).toBe(false);
  });
});

describe('generateHMACDoubleCSRFToken', () => {
  const secret = 'test-secret';
  const sessionId = 'session-123';

  it('should generate a token with correct format', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const parts = token.split(':');
    
    expect(parts).toHaveLength(4);
    expect(parts[0]).toHaveLength(32); // randomValue (16 bytes = 32 hex chars)
    expect(parts[1]).toMatch(/^\d+$/); // timestamp
    expect(parts[2]).toBe(sessionId); // sessionId
    expect(parts[3]).toHaveLength(64); // HMAC SHA256 (32 bytes = 64 hex chars)
  });

  it('should generate different tokens each time', () => {
    const token1 = generateHMACDoubleCSRFToken(secret, sessionId);
    const token2 = generateHMACDoubleCSRFToken(secret, sessionId);
    
    expect(token1).not.toBe(token2);
  });

  it('should generate different tokens for different session IDs', () => {
    const token1 = generateHMACDoubleCSRFToken(secret, 'session-1');
    const token2 = generateHMACDoubleCSRFToken(secret, 'session-2');
    
    expect(token1).not.toBe(token2);
  });

  it('should generate different tokens for different secrets', () => {
    const token1 = generateHMACDoubleCSRFToken('secret-1', sessionId);
    const token2 = generateHMACDoubleCSRFToken('secret-2', sessionId);
    
    expect(token1).not.toBe(token2);
  });
});

describe('validateHMACDoubleCSRFToken', () => {
  const secret = 'test-secret';
  const sessionId = 'session-123';

  it('should validate a correctly generated token', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken(secret, token, token, sessionId);
    
    expect(isValid).toBe(true);
  });

  it('should return false when cookie and header tokens do not match', () => {
    const token1 = generateHMACDoubleCSRFToken(secret, sessionId);
    const token2 = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken(secret, token1, token2, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false when cookie token is missing', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken(secret, undefined, token, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false when header token is missing', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken(secret, token, undefined, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false for wrong session ID', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken(secret, token, token, 'wrong-session');
    
    expect(isValid).toBe(false);
  });

  it('should return false for wrong secret', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const isValid = validateHMACDoubleCSRFToken('wrong-secret', token, token, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false for malformed token (too few parts)', () => {
    const malformedToken = 'random:timestamp:hmac'; // 3 parts instead of 4
    const isValid = validateHMACDoubleCSRFToken(secret, malformedToken, malformedToken, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false for malformed token (too many parts)', () => {
    const malformedToken = 'random:timestamp:session:hmac:extra'; // 5 parts instead of 4
    const isValid = validateHMACDoubleCSRFToken(secret, malformedToken, malformedToken, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false for tampered token', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const parts = token.split(':');
    // Tamper with the random value by changing the first character
    parts[0] = parts[0].substring(1) + '0';
    const tamperedToken = parts.join(':');
    
    const isValid = validateHMACDoubleCSRFToken(secret, tamperedToken, tamperedToken, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should return false for tampered HMAC', () => {
    const token = generateHMACDoubleCSRFToken(secret, sessionId);
    const parts = token.split(':');
    // Tamper with the HMAC by changing the first character
    parts[3] = parts[3].substring(1) + '0';
    const tamperedToken = parts.join(':');
    
    const isValid = validateHMACDoubleCSRFToken(secret, tamperedToken, tamperedToken, sessionId);
    
    expect(isValid).toBe(false);
  });

  it('should handle invalid token format gracefully', () => {
    const invalidToken = 'not-a-valid-token';
    const isValid = validateHMACDoubleCSRFToken(secret, invalidToken, invalidToken, sessionId);
    
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
