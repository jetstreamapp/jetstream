import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAtomValues: Record<string, unknown> = {};

vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {
    appInfoState: 'appInfoState',
  },
}));

vi.mock('jotai', () => ({
  useAtomValue: (atom: string) => mockAtomValues[atom],
}));

const TEST_TOKEN = 'test-rum-token';

function getInjectedScripts() {
  return Array.from(document.head.querySelectorAll('script')).filter((script) => script.src.includes('betterstack.net/b.js'));
}

function getBetterstack() {
  return (window as { betterstack?: { (...args: unknown[]): void; q?: unknown[][] } }).betterstack;
}

async function importLoader() {
  return await import('../analytics-tag-loader');
}

describe('useAnalyticsTagLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NX_PUBLIC_BETTERSTACK_RUM_TOKEN', TEST_TOKEN);
    mockAtomValues['appInfoState'] = { appInfo: { environment: 'test', serverUrl: 'http://localhost:3333' }, version: '1.2.3' };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    getInjectedScripts().forEach((script) => script.remove());
    delete (window as { betterstack?: unknown }).betterstack;
  });

  it('does nothing without a token', async () => {
    vi.stubEnv('NX_PUBLIC_BETTERSTACK_RUM_TOKEN', '');
    const { useAnalyticsTagLoader } = await importLoader();

    renderHook(() => useAnalyticsTagLoader(true));

    expect(getBetterstack()).toBeUndefined();
    expect(getInjectedScripts()).toHaveLength(0);
  });

  it('does not load the tag until consent is granted', async () => {
    const { useAnalyticsTagLoader } = await importLoader();

    renderHook(() => useAnalyticsTagLoader(false));

    expect(getBetterstack()).toBeUndefined();
    expect(getInjectedScripts()).toHaveLength(0);
  });

  it('loads the tag once and queues init when consent is granted', async () => {
    const { useAnalyticsTagLoader } = await importLoader();

    const { rerender } = renderHook(() => useAnalyticsTagLoader(true));
    rerender();
    renderHook(() => useAnalyticsTagLoader(true));

    expect(getInjectedScripts()).toHaveLength(1);
    expect(getInjectedScripts()[0].src).toContain(`t=${TEST_TOKEN}`);
    expect(getBetterstack()?.q?.[0]).toEqual(['init', { environment: 'test', release: '1.2.3', autoPageview: true }]);
  });
});
