import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreQuery } from '../query-restore-utils';
import { useQueryRestore } from '../useQueryRestore';

vi.mock('@jetstream/ui/app-state', async (importOriginal) => {
  const { atom } = await import('jotai');
  return {
    ...(await importOriginal<typeof import('@jetstream/ui/app-state')>()),
    selectedOrgState: atom({ uniqueId: 'org-1' }),
  };
});

vi.mock('../query-restore-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../query-restore-utils')>()),
  restoreQuery: vi.fn(),
}));

const restoreQueryMock = vi.mocked(restoreQuery);

const RESTORE_RESULT = {
  missingFields: [],
  missingSubqueryFields: {},
  missingMisc: {},
  queryFieldsMapState: {},
  selectedQueryFieldsState: [],
  selectedSubqueryFieldsState: {},
  queryChildRelationships: [],
  sObjectsState: [],
  filterQueryFieldsState: [],
  orderByQueryFieldsState: [],
  groupByQueryFieldsState: [],
} as unknown as Awaited<ReturnType<typeof restoreQuery>>;

describe('useQueryRestore endRestore callback', () => {
  beforeEach(() => {
    restoreQueryMock.mockReset();
  });

  // Callers close their modal/popover when fatalError is false, so the tooling flag must never land in that position
  it.each([true, false])('reports fatalError=false first on a successful restore (isTooling=%s)', async (isTooling) => {
    restoreQueryMock.mockResolvedValue(RESTORE_RESULT);
    const endRestore = vi.fn();
    const { result } = renderHook(() => useQueryRestore('SELECT Id FROM ApexClass', isTooling, { endRestore, silent: true }));

    await act(async () => {
      await result.current[0](undefined, isTooling);
    });

    expect(endRestore).toHaveBeenCalledTimes(1);
    expect(endRestore).toHaveBeenCalledWith(false, isTooling, expect.any(Object));
  });

  it.each([true, false])('reports fatalError=true first when the restore fails (isTooling=%s)', async (isTooling) => {
    restoreQueryMock.mockRejectedValue(new Error('describe failed'));
    const endRestore = vi.fn();
    const { result } = renderHook(() => useQueryRestore('SELECT Id FROM ApexClass', isTooling, { endRestore, silent: true }));

    await act(async () => {
      await result.current[0](undefined, isTooling);
    });

    expect(endRestore).toHaveBeenCalledTimes(1);
    expect(endRestore).toHaveBeenCalledWith(true, isTooling);
  });
});
