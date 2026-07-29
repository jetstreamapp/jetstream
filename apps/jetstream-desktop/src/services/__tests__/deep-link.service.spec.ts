import logger from 'electron-log';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deepLink, handleCustomUrl } from '../deep-link.service';

vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    quit: vi.fn(),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1Nisecret-jwt-value';
const CSRF_TOKEN = 'csrf-nonce-value';
const DEVICE_ID = 'device-123';

/** All strings the logger received across every info/error call, joined for easy substring assertions. */
function allLoggedText(): string {
  const calls = [...vi.mocked(logger.info).mock.calls, ...vi.mocked(logger.error).mock.calls];
  return calls.map((args) => args.join(' ')).join('\n');
}

describe('handleCustomUrl', () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never logs sensitive param values from the query string', () => {
    handleCustomUrl(`jetstream://auth?deviceId=${DEVICE_ID}&token=${CSRF_TOKEN}&accessToken=${ACCESS_TOKEN}`);

    const logged = allLoggedText();
    expect(logged).not.toContain(ACCESS_TOKEN);
    expect(logged).not.toContain(CSRF_TOKEN);
    // Param names are still logged for debuggability
    expect(logged).toContain('accessToken');
    expect(logged).toContain('auth');
  });

  it('never logs sensitive param values carried in the hash fragment', () => {
    handleCustomUrl(`jetstream://auth?deviceId=${DEVICE_ID}#accessToken=${ACCESS_TOKEN}`);

    const logged = allLoggedText();
    expect(logged).not.toContain(ACCESS_TOKEN);
    expect(logged).toContain('accessToken');
  });

  it('still dispatches query and hash params (merged) to listeners', () => {
    const listener = vi.fn();
    deepLink.on('auth', listener);

    handleCustomUrl(`jetstream://auth?deviceId=${DEVICE_ID}&token=${CSRF_TOKEN}#accessToken=${ACCESS_TOKEN}`);

    expect(listener).toHaveBeenCalledWith({
      deviceId: DEVICE_ID,
      token: CSRF_TOKEN,
      accessToken: ACCESS_TOKEN,
    });
    deepLink.remove('auth', listener);
  });

  it('rejects non-jetstream protocols without dispatching', () => {
    const listener = vi.fn();
    deepLink.on('auth', listener);

    handleCustomUrl(`https://evil.example.com/auth?accessToken=${ACCESS_TOKEN}`);

    expect(listener).not.toHaveBeenCalled();
    expect(allLoggedText()).not.toContain(ACCESS_TOKEN);
    deepLink.remove('auth', listener);
  });
});
