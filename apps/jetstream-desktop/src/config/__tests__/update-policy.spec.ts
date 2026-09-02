import { describe, expect, it } from 'vitest';
import {
  computeNsisAppGuid,
  getMacOsManagedPreferenceDomains,
  parseManagedPolicyFile,
  resolveUpdatePolicy,
  toBoolean,
  type UpdatePolicyEnvironment,
} from '../update-policy';

const NO_POLICY: UpdatePolicyEnvironment = {
  disabledByCommandLine: false,
  disabledByEnvironment: null,
  disabledByManagedPolicy: null,
  perMachineInstall: false,
};

describe('update-policy#computeNsisAppGuid', () => {
  /**
   * Pins the GUID the current appId produces. electron-builder derives the installer's registry key
   * from it, so if this value ever changes the per-machine detection is silently reading the wrong
   * key - which would bring back the every-launch UAC prompt this whole feature exists to stop.
   */
  it('derives the same GUID electron-builder generates for the Jetstream appId', () => {
    expect(computeNsisAppGuid('app.getjetstream')).toBe('1cc64917-37e3-5b25-bfd9-19c922591cc1');
  });

  it('produces a well-formed v5 UUID', () => {
    expect(computeNsisAppGuid('com.example.app')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('update-policy#toBoolean', () => {
  it.each([
    ['1', true],
    ['0x1', true],
    ['true', true],
    ['YES', true],
    [' on ', true],
    ['0', false],
    ['0x0', false],
    ['false', false],
    ['no', false],
    [true, true],
    [false, false],
    [1, true],
    [0, false],
  ])('parses %j as %j', (value, expected) => {
    expect(toBoolean(value)).toBe(expected);
  });

  it.each([[undefined], [null], [''], ['maybe'], [{}]])('treats %j as unset rather than guessing', (value) => {
    expect(toBoolean(value)).toBeNull();
  });
});

describe('update-policy#getMacOsManagedPreferenceDomains', () => {
  it('consults the device-channel profile before the user-channel one', () => {
    expect(getMacOsManagedPreferenceDomains('jdoe')).toEqual([
      '/Library/Managed Preferences/app.getjetstream',
      '/Library/Managed Preferences/jdoe/app.getjetstream',
    ]);
  });
});

describe('update-policy#parseManagedPolicyFile', () => {
  it('reads the documented key with any of the accepted truthy spellings', () => {
    expect(parseManagedPolicyFile({ DisableAutoUpdate: true })).toBe(true);
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 'yes' })).toBe(true);
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 0 })).toBe(false);
  });

  it('treats a file without the exact key as no opinion', () => {
    expect(parseManagedPolicyFile({})).toBeNull();
    expect(parseManagedPolicyFile({ disableAutoUpdate: true })).toBeNull();
  });

  it('treats a malformed file as no opinion', () => {
    expect(parseManagedPolicyFile(null)).toBeNull();
    expect(parseManagedPolicyFile('DisableAutoUpdate')).toBeNull();
    expect(parseManagedPolicyFile({ DisableAutoUpdate: 'maybe' })).toBeNull();
  });
});

describe('update-policy#resolveUpdatePolicy', () => {
  it('enables updates when nothing is configured', () => {
    expect(resolveUpdatePolicy(NO_POLICY, true)).toEqual({
      autoUpdateEnabled: true,
      allowManualCheck: true,
      source: 'default',
      managed: false,
      perMachineInstall: false,
    });
  });

  it('lets the user turn off automatic updates but keeps manual checks working', () => {
    expect(resolveUpdatePolicy(NO_POLICY, false)).toEqual({
      autoUpdateEnabled: false,
      allowManualCheck: true,
      source: 'user-preference',
      managed: false,
      perMachineInstall: false,
    });
  });

  it('removes the manual check too when an administrator disables updates', () => {
    expect(resolveUpdatePolicy({ ...NO_POLICY, disabledByManagedPolicy: true }, true)).toEqual({
      autoUpdateEnabled: false,
      allowManualCheck: false,
      source: 'managed-policy',
      managed: true,
      perMachineInstall: false,
    });
  });

  it('lets an administrator policy override a user who disabled updates', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByManagedPolicy: false }, false);
    expect(policy.autoUpdateEnabled).toBe(true);
    expect(policy.managed).toBe(true);
    expect(policy.source).toBe('managed-policy');
  });

  it('prefers the command line over every other source', () => {
    const policy = resolveUpdatePolicy(
      { ...NO_POLICY, disabledByCommandLine: true, disabledByEnvironment: false, disabledByManagedPolicy: false },
      true,
    );
    expect(policy.autoUpdateEnabled).toBe(false);
    expect(policy.source).toBe('command-line');
  });

  it('prefers the environment variable over the managed policy', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByEnvironment: true, disabledByManagedPolicy: false }, true);
    expect(policy.autoUpdateEnabled).toBe(false);
    expect(policy.source).toBe('environment');
  });

  it('falls through an environment variable that is set but unparseable', () => {
    const policy = resolveUpdatePolicy({ ...NO_POLICY, disabledByEnvironment: null, disabledByManagedPolicy: true }, true);
    expect(policy.source).toBe('managed-policy');
  });

  it('carries the per-machine install flag through every decision', () => {
    const environment = { ...NO_POLICY, perMachineInstall: true };
    expect(resolveUpdatePolicy(environment, true).perMachineInstall).toBe(true);
    expect(resolveUpdatePolicy(environment, false).perMachineInstall).toBe(true);
    expect(resolveUpdatePolicy({ ...environment, disabledByManagedPolicy: true }, true).perMachineInstall).toBe(true);
  });
});
