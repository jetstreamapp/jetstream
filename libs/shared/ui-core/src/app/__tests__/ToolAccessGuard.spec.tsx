import { MAIN_CONTENT_ID } from '@jetstream/ui';
import { act, render, screen } from '@testing-library/react';
import { createStore, PrimitiveAtom, Provider } from 'jotai';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ToolAccessGuard } from '../ToolAccessGuard';

const { isPathAllowedByAccessProfile, testAbilityState } = vi.hoisted(() => ({
  isPathAllowedByAccessProfile: vi.fn(),
  testAbilityState: { current: null as PrimitiveAtom<{ revision: number }> | null },
}));

vi.mock('@jetstream/shared/ui-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-router')>()),
  isPathAllowedByAccessProfile,
}));

// The ability itself is irrelevant once the access check is mocked - replacing it just re-renders the guard,
// the way a heartbeat that changes the access profile does
vi.mock('@jetstream/ui/app-state', async (importOriginal) => {
  const { atom } = await import('jotai');
  testAbilityState.current = atom({ revision: 0 });
  return {
    ...(await importOriginal<typeof import('@jetstream/ui/app-state')>()),
    abilityState: testAbilityState.current,
  };
});

function renderGuard() {
  const store = createStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/query']}>
        <main id={MAIN_CONTENT_ID}>
          <Routes>
            <Route element={<ToolAccessGuard />}>
              <Route
                path="/query"
                element={
                  <button type="button" data-testid="tool-control">
                    Run Query
                  </button>
                }
              />
            </Route>
          </Routes>
        </main>
      </MemoryRouter>
    </Provider>,
  );
  return {
    mainContent: document.getElementById(MAIN_CONTENT_ID) as HTMLElement,
    revokeAccess: () =>
      act(() => {
        isPathAllowedByAccessProfile.mockReturnValue(false);
        if (testAbilityState.current) {
          store.set(testAbilityState.current, { revision: 1 });
        }
      }),
  };
}

describe('ToolAccessGuard', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.title = '';
  });

  test('moves focus to the main content when access is removed while the tool is open', () => {
    isPathAllowedByAccessProfile.mockReturnValue(true);
    const { mainContent, revokeAccess } = renderGuard();
    screen.getByRole('button', { name: 'Run Query' }).focus();

    revokeAccess();

    expect(screen.queryByTestId('tool-control')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Tool Not Available' })).toBeTruthy();
    expect(document.activeElement).toBe(mainContent);
  });

  test('leaves focus alone when the blocked tool is the page that loaded', () => {
    isPathAllowedByAccessProfile.mockReturnValue(false);
    renderGuard();

    expect(screen.getByRole('link', { name: 'Go to Home' })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    expect(document.title).toBe('Tool Not Available | Jetstream');
  });
});
