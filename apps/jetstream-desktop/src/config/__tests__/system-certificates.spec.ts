import { beforeEach, describe, expect, it, vi } from 'vitest';

const tlsMock = vi.hoisted(() => ({
  getCACertificates: vi.fn((type: string) => (type === 'system' ? ['SYSTEM_CA'] : ['BUNDLED_CA'])),
  setDefaultCACertificates: vi.fn(),
}));

vi.mock('node:tls', () => ({ default: tlsMock }));
vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

// The module tracks what it has applied, so each test starts from a fresh copy
async function loadModule() {
  vi.resetModules();
  return import('../system-certificates');
}

describe('system-certificates#applySystemCertificateTrust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tlsMock.getCACertificates.mockImplementation((type: string) => (type === 'system' ? ['SYSTEM_CA'] : ['BUNDLED_CA']));
  });

  it('leaves Node defaults untouched when disabled at startup', async () => {
    const { applySystemCertificateTrust } = await loadModule();
    applySystemCertificateTrust(false);
    expect(tlsMock.setDefaultCACertificates).not.toHaveBeenCalled();
  });

  it('adds the OS store to the bundled certificates rather than replacing them', async () => {
    const { applySystemCertificateTrust } = await loadModule();
    applySystemCertificateTrust(true);
    expect(tlsMock.setDefaultCACertificates).toHaveBeenCalledWith(['BUNDLED_CA', 'SYSTEM_CA']);
  });

  it('restores the original certificates when turned off', async () => {
    const { applySystemCertificateTrust } = await loadModule();
    applySystemCertificateTrust(true);
    // After the first change the default list includes the OS store, so it must not be re-read as the baseline
    tlsMock.getCACertificates.mockImplementation((type: string) => (type === 'system' ? ['SYSTEM_CA'] : ['BUNDLED_CA', 'SYSTEM_CA']));
    applySystemCertificateTrust(false);
    expect(tlsMock.setDefaultCACertificates).toHaveBeenLastCalledWith(['BUNDLED_CA']);
  });

  it('does not re-read the OS store when the setting is saved unchanged', async () => {
    const { applySystemCertificateTrust } = await loadModule();
    applySystemCertificateTrust(true);
    applySystemCertificateTrust(true);
    expect(tlsMock.setDefaultCACertificates).toHaveBeenCalledTimes(1);
  });

  it('keeps working when the certificates cannot be applied, and retries on the next save', async () => {
    const { applySystemCertificateTrust } = await loadModule();
    tlsMock.setDefaultCACertificates.mockImplementationOnce(() => {
      throw new Error('bad certificate');
    });
    expect(() => applySystemCertificateTrust(true)).not.toThrow();
    applySystemCertificateTrust(true);
    expect(tlsMock.setDefaultCACertificates).toHaveBeenCalledTimes(2);
  });
});
