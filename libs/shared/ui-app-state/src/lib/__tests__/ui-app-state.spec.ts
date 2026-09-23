import { ApiRequestError } from '@jetstream/shared/data';
import type { UserProfileUi } from '@jetstream/types';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { createElement, ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedGetUserProfile, mockedIsBrowserExtension, mockedIsCanvasApp, mockedIsDesktop, mockedApplyVerifiedFeatureFlags } = vi.hoisted(
  () => ({
    mockedGetUserProfile: vi.fn(),
    mockedIsBrowserExtension: vi.fn(() => false),
    mockedIsCanvasApp: vi.fn(() => false),
    mockedIsDesktop: vi.fn(() => false),
    mockedApplyVerifiedFeatureFlags: vi.fn((profile: UserProfileUi) => Promise.resolve(profile)),
  }),
);

vi.mock('@jetstream/shared/data', async (importOriginal) => {
  // The real error classification (`ApiRequestError` / `isAuthenticationFailure`) is what decides
  // signed-out vs. transient failure, so it stays under test — only the network calls are replaced.
  const actual = await importOriginal<typeof import('@jetstream/shared/data')>();
  return {
    ...actual,
    getUserProfile: mockedGetUserProfile,
    checkHeartbeat: vi.fn(() => Promise.resolve({ appInfo: {}, version: 'test', announcements: [] })),
    getOrgs: vi.fn(() => Promise.resolve([])),
    getOrgGroups: vi.fn(() => Promise.resolve([])),
    getLocalStore: vi.fn(() => ({ getItem: vi.fn(() => Promise.resolve(null)), setItem: vi.fn() })),
  };
});

vi.mock('@jetstream/shared/ui-utils', () => ({
  applyVerifiedFeatureFlags: mockedApplyVerifiedFeatureFlags,
  isBrowserExtension: mockedIsBrowserExtension,
  isCanvasApp: mockedIsCanvasApp,
  isDesktop: mockedIsDesktop,
  getBrowserExtensionVersion: vi.fn(() => 'test'),
  getOrgType: vi.fn(),
  setItemInLocalStorage: vi.fn(),
  setItemInSessionStorage: vi.fn(),
}));

const PROFILE = { id: 'user-1', userId: 'user-1', email: 'user@example.com' } as UserProfileUi;

/**
 * The profile fetch fires at module evaluation, so every scenario needs the module re-evaluated with
 * the mocks already set up for it.
 */
async function loadAppState() {
  vi.resetModules();
  return await import('../ui-app-state');
}

describe('userProfileState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsBrowserExtension.mockReturnValue(false);
    mockedIsCanvasApp.mockReturnValue(false);
    mockedIsDesktop.mockReturnValue(false);
    mockedApplyVerifiedFeatureFlags.mockImplementation((profile: UserProfileUi) => Promise.resolve(profile));
  });

  it('resolves to the profile returned by the server', async () => {
    mockedGetUserProfile.mockResolvedValue(PROFILE);

    const { userProfileState } = await loadAppState();

    await expect(createStore().get(userProfileState)).resolves.toEqual(PROFILE);
    expect(mockedApplyVerifiedFeatureFlags).toHaveBeenCalledWith(PROFILE);
  });

  it.each([401, 403])('falls back to the logged out profile when the server rejects with %i', async (status) => {
    mockedGetUserProfile.mockRejectedValue(new ApiRequestError('Unauthorized', status));

    const { userProfileState, DEFAULT_PROFILE } = await loadAppState();

    await expect(createStore().get(userProfileState)).resolves.toEqual(DEFAULT_PROFILE);
  });

  it.each([
    ['a network failure', null],
    ['a server error', 500],
    ['rate limiting', 429],
  ])('fails the boot rather than presenting the session as logged out after %s', async (_scenario, status) => {
    const cause = new ApiRequestError('Request failed', status);
    mockedGetUserProfile.mockRejectedValue(cause);

    const { userProfileState, UserProfileUnavailableError } = await loadAppState();

    const error = await Promise.resolve(createStore().get(userProfileState)).then(
      () => null,
      (ex) => ex,
    );
    expect(error).toBeInstanceOf(UserProfileUnavailableError);
    expect(error.cause).toBe(cause);
  });

  it('keeps the logged out profile on desktop, where the main process supplies the real profile', async () => {
    mockedIsDesktop.mockReturnValue(true);
    mockedGetUserProfile.mockRejectedValue(new ApiRequestError('Network Error', null));

    const { userProfileState, DEFAULT_PROFILE } = await loadAppState();

    await expect(createStore().get(userProfileState)).resolves.toEqual(DEFAULT_PROFILE);
  });

  it.each([
    ['browser extension', mockedIsBrowserExtension],
    ['canvas app', mockedIsCanvasApp],
  ])('uses the default profile for the %s without calling the server', async (_scenario, isCurrentApp) => {
    isCurrentApp.mockReturnValue(true);

    const { userProfileState, DEFAULT_PROFILE } = await loadAppState();

    await expect(createStore().get(userProfileState)).resolves.toEqual(DEFAULT_PROFILE);
    expect(mockedGetUserProfile).not.toHaveBeenCalled();
  });
});

describe('useUserPreferenceState', () => {
  /**
   * Preference readers (theme, header, notifications prompt, analytics) sit directly under the app's
   * top level Suspense boundary, so a write that re-suspends them swaps the whole page for the loading
   * fallback.
   */
  it('updates preferences without re-suspending the components reading them', async () => {
    const { useUserPreferenceState } = await loadAppState();
    const store = createStore();
    let fallbackRenders = 0;
    const Fallback = () => {
      fallbackRenders++;
      return null;
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store }, createElement(Suspense, { fallback: createElement(Fallback) }, children));

    // The first read is an async storage lookup, so the initial render is expected to suspend once
    const { result } = await act(async () => renderHook(() => useUserPreferenceState(), { wrapper }));
    expect(result.current[0]).toEqual({ colorScheme: 'light' });
    const fallbackRendersAfterLoad = fallbackRenders;

    act(() => {
      const [userPreferences, setUserPreferences] = result.current;
      setUserPreferences({ ...userPreferences, deniedNotifications: true });
    });

    expect(result.current[0]).toEqual({ colorScheme: 'light', deniedNotifications: true });
    expect(fallbackRenders).toBe(fallbackRendersAfterLoad);
  });
});
