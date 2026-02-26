import { describe, expect, it } from 'vitest';
import { getCookieConfig } from '../auth.utils';

describe('auth.utils getCookieConfig', () => {
  it('returns secure cookies when flag is true', () => {
    const cfg = getCookieConfig(true);
    expect(cfg.pkceCodeVerifier.options.secure).toBe(true);
    expect(cfg.state.options.secure).toBe(true);
    expect(cfg.nonce.options.secure).toBe(true);
  });

  it('returns non-secure cookies when flag is false', () => {
    const cfg = getCookieConfig(false);
    expect(cfg.pkceCodeVerifier.options.secure).toBe(false);
  });
});
