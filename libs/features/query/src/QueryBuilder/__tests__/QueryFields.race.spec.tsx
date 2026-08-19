import { QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { fromQueryState } from '@jetstream/ui-core';
import { render, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QueryFieldsComponent from '../QueryFields';

/** Field fetches are held open so the tests control the order they resolve in */
const { deferredFetches, mockOrg } = vi.hoisted(() => ({
  deferredFetches: new Map<string, { resolve: (value: any) => void; reject: (err: Error) => void }>(),
  mockOrg: { uniqueId: 'org-1', label: 'Org 1' },
}));

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ serverUrl: 'http://localhost' }),
    selectedOrgState: atom(mockOrg),
  };
});

vi.mock('@jetstream/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/ui')>()),
  AutoFullHeightContainer: ({ children }: any) => <div>{children}</div>,
  SobjectFieldList: ({ itemKey, queryFieldsMap }: any) => (
    <div data-testid="field-list" data-item-key={itemKey} data-loading={String(!!queryFieldsMap[itemKey]?.loading)} />
  ),
}));

vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  fetchFields: vi.fn(
    (_org: SalesforceOrgUi, queryFields: QueryFields) =>
      new Promise<QueryFields>((resolve, reject) => {
        deferredFetches.set(queryFields.sobject, { resolve, reject });
      }),
  ),
}));

function buildFetchedFields(sobject: string): QueryFields {
  return {
    key: `${sobject}|`,
    expanded: true,
    loading: true,
    isPolymorphic: false,
    hasError: false,
    filterTerm: '',
    sobject,
    fields: { Id: { name: 'Id', label: 'Id', type: 'Id', sobject, filterText: 'id', metadata: { name: 'Id' } as any } as any },
    visibleFields: new Set(['Id']),
    selectedFields: new Set<string>(),
    childRelationships: [],
  } as unknown as QueryFields;
}

describe('QueryFields async races (github issues #233 / #364)', () => {
  beforeEach(() => {
    deferredFetches.clear();
  });

  it('#233 - an out-of-order field fetch clobbers the currently selected object', async () => {
    const store = createStore();
    const { rerender, getByTestId } = render(
      <Provider store={store}>
        <QueryFieldsComponent selectedSObject="Account" isTooling={false} onSelectionChanged={vi.fn()} />
      </Provider>,
    );

    await waitFor(() => expect(deferredFetches.has('Account')).toBe(true));

    // user quickly switches to a different object before the first fetch resolves
    rerender(
      <Provider store={store}>
        <QueryFieldsComponent selectedSObject="Contact" isTooling={false} onSelectionChanged={vi.fn()} />
      </Provider>,
    );
    await waitFor(() => expect(deferredFetches.has('Contact')).toBe(true));

    // Contact (the current selection) resolves first, Account (abandoned) resolves last
    deferredFetches.get('Contact')?.resolve(buildFetchedFields('Contact'));
    await waitFor(() => expect(getByTestId('field-list').getAttribute('data-loading')).toBe('false'));

    deferredFetches.get('Account')?.resolve(buildFetchedFields('Account'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // the abandoned Account fetch must not overwrite state belonging to Contact
    expect(Object.keys(store.get(fromQueryState.queryFieldsMapState))).toEqual(['Contact|']);
    expect(store.get(fromQueryState.queryFieldsKey)).toBe('org-1-Contact');
    expect(getByTestId('field-list').getAttribute('data-item-key')).toBe('Contact|');
  });

  it('#364 - unmounting mid-fetch leaves a permanent loading entry that the next mount will not retry', async () => {
    const store = createStore();
    const { unmount } = render(
      <Provider store={store}>
        <QueryFieldsComponent selectedSObject="Account" isTooling={false} onSelectionChanged={vi.fn()} />
      </Provider>,
    );

    await waitFor(() => expect(deferredFetches.has('Account')).toBe(true));
    expect(store.get(fromQueryState.queryFieldsMapState)['Account|'].loading).toBe(true);

    // navigate away (execute query / change org) before fields come back
    unmount();
    deferredFetches.get('Account')?.resolve(buildFetchedFields('Account'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    deferredFetches.clear();

    // navigate back
    const { getByTestId } = render(
      <Provider store={store}>
        <QueryFieldsComponent selectedSObject="Account" isTooling={false} onSelectionChanged={vi.fn()} />
      </Provider>,
    );

    // the abandoned fetch must not be mistaken for a completed one - the fields have to be fetched again
    await waitFor(() => expect(deferredFetches.has('Account')).toBe(true));
    deferredFetches.get('Account')?.resolve(buildFetchedFields('Account'));

    await waitFor(() => expect(getByTestId('field-list').getAttribute('data-loading')).toBe('false'));
  });
});
