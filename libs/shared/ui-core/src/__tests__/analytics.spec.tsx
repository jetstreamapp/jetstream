import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module under test reads jotai atoms from app-state; stub the atom identities and resolve
// them to canned values so the hook renders without a jotai Provider or async atom plumbing.
const mockAtomValues: Record<string, unknown> = {};

vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {
    appInfoState: 'appInfoState',
    userProfileState: 'userProfileState',
    selectUserPreferenceState: 'selectUserPreferenceState',
  },
}));

vi.mock('jotai', () => ({
  useAtomValue: (atom: string) => mockAtomValues[atom],
}));

type StubbedTag = { (...args: unknown[]): void; q?: unknown[][] };

function installTagStub() {
  // Mirrors the queue stub that the web-only useAnalyticsTagLoader creates
  const stub: StubbedTag = (...args: unknown[]) => {
    (stub.q = stub.q || []).push(args);
  };
  (window as { betterstack?: StubbedTag }).betterstack = stub;
  return stub;
}

function getQueuedCommands(): unknown[][] {
  return (window as { betterstack?: StubbedTag }).betterstack?.q ?? [];
}

async function importAnalytics() {
  return await import('../analytics');
}

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAtomValues['appInfoState'] = { appInfo: { environment: 'test', serverUrl: 'http://localhost:3333' }, version: '1.2.3' };
    mockAtomValues['userProfileState'] = { id: 'user-123', emailVerified: true, email: 'person@example.com' };
    mockAtomValues['selectUserPreferenceState'] = { deniedNotifications: false };
  });

  afterEach(() => {
    delete (window as { betterstack?: unknown }).betterstack;
  });

  it('no-ops safely when the tag was never loaded (extension/desktop/canvas hosts)', async () => {
    const { useAnalytics, track, clearAnalyticsUser } = await importAnalytics();

    const { result } = renderHook(() => useAnalytics(false));
    result.current.trackEvent('some_event', { foo: 'bar' });
    track('some_event');
    clearAnalyticsUser();

    expect((window as { betterstack?: unknown }).betterstack).toBeUndefined();
  });

  it('drops events until consent is granted', async () => {
    installTagStub();
    const { useAnalytics, track } = await importAnalytics();

    track('before_consent');
    // optOut=true mirrors AppInitializer before the user accepts the cookie banner
    renderHook(() => useAnalytics(true));
    track('still_opted_out');
    // feature components pass no argument and must never flip consent
    renderHook(() => useAnalytics());
    track('still_no_consent');

    expect(getQueuedCommands()).toHaveLength(0);
  });

  it('tracks custom events once consent is granted', async () => {
    installTagStub();
    const { useAnalytics } = await importAnalytics();

    const { result } = renderHook(() => useAnalytics(false));
    result.current.trackEvent('after_consent', { foo: 'bar' });

    const trackCommands = getQueuedCommands().filter(([command]) => command === 'track');
    expect(trackCommands).toEqual([['track', 'after_consent', { foo: 'bar' }]]);
  });

  it('identifies the user by id without email', async () => {
    installTagStub();
    const { useAnalytics } = await importAnalytics();

    renderHook(() => useAnalytics(false));

    const userCommands = getQueuedCommands().filter(([command]) => command === 'user');
    expect(userCommands).toHaveLength(1);
    const userPayload = userCommands[0][1] as Record<string, unknown>;
    expect(userPayload.id).toBe('user-123');
    expect(userPayload).not.toHaveProperty('email');
    expect(userPayload).not.toHaveProperty('username');
  });

  it('clears the user and stops tracking when consent is revoked', async () => {
    installTagStub();
    const { useAnalytics, track } = await importAnalytics();

    const { result, rerender } = renderHook(({ optOut }: { optOut: boolean }) => useAnalytics(optOut), {
      initialProps: { optOut: false },
    });
    result.current.trackEvent('while_consented');
    rerender({ optOut: true });
    track('after_revoke');

    const commands = getQueuedCommands();
    expect(commands).toContainEqual(['user', null]);
    expect(commands.filter(([command]) => command === 'track')).toEqual([['track', 'while_consented', undefined]]);
  });
});
