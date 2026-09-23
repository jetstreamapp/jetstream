import { ListMetadataResultItem } from '@jetstream/connected-ui';
import { ListMetadataResult } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { atom, Provider } from 'jotai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DeployMetadataDeploymentTable from '../DeployMetadataDeploymentTable';
import { getRows } from '../utils/deploy-metadata.utils';

vi.mock('@jetstream/ui-core', () => ({ fromDeployMetadataState: { hideEmptyMetadataTypesState: atom(false) } }));

// The row/column virtualizers measure the scroll container, which jsdom reports as 0x0 — nothing would
// render. Give every element a viewport-sized box so the grid mounts real rows.
beforeAll(() => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value: 600 });
  }
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

function getListMetadataResult(type: string, fullName: string): ListMetadataResult {
  return {
    createdById: '005000000000000',
    createdByName: 'Test User',
    createdDate: new Date('2026-01-01T00:00:00.000Z'),
    fileName: `${type}/${fullName}`,
    fullName,
    id: `${type}-${fullName}`,
    lastModifiedById: '005000000000000',
    lastModifiedByName: 'Test User',
    lastModifiedDate: new Date('2026-01-01T00:00:00.000Z'),
    manageableState: 'unmanaged',
    type,
  };
}

function getListMetadataItem(type: string, overrides: Partial<ListMetadataResultItem> = {}): ListMetadataResultItem {
  return { type, inFolder: false, loading: false, error: null, lastRefreshed: null, items: [], ...overrides };
}

const rows = getRows({
  ApexClass: getListMetadataItem('ApexClass', {
    items: [getListMetadataResult('ApexClass', 'AccountTriggerHandler'), getListMetadataResult('ApexClass', 'AddPrimaryContact')],
  }),
  AnalyticSnapshot: getListMetadataItem('AnalyticSnapshot'),
  AnimationRule: getListMetadataItem('AnimationRule'),
  ApexTrigger: getListMetadataItem('ApexTrigger', { error: true }),
  ApexPage: getListMetadataItem('ApexPage', { loading: true }),
});

function setup() {
  return render(
    <Provider>
      <DeployMetadataDeploymentTable
        rows={rows}
        hasSelectedRows={false}
        onSelectedRows={vi.fn()}
        onViewOrCompareOpen={vi.fn()}
        onViewItem={vi.fn()}
      />
    </Provider>,
  );
}

function getHideEmptyTypesCheckbox() {
  return screen.getByLabelText('Hide Empty Types');
}

describe('DeployMetadataDeploymentTable', () => {
  it('shows metadata types with no components by default', () => {
    setup();

    expect(getHideEmptyTypesCheckbox()).toHaveProperty('checked', false);
    expect(screen.getByText('Analytic Snapshots')).toBeTruthy();
    expect(screen.getByText('Animation Rules')).toBeTruthy();
    expect(screen.getAllByText('No metadata found')).toHaveLength(2);
    expect(screen.getByText('Showing 6 of 6 objects')).toBeTruthy();
  });

  it('hides metadata types with no components when enabled', () => {
    setup();

    fireEvent.click(getHideEmptyTypesCheckbox());

    expect(getHideEmptyTypesCheckbox()).toHaveProperty('checked', true);
    expect(screen.queryByText('Analytic Snapshots')).toBeNull();
    expect(screen.queryByText('Animation Rules')).toBeNull();
    expect(screen.queryByText('No metadata found')).toBeNull();
    expect(screen.getByText('AccountTriggerHandler')).toBeTruthy();
    expect(screen.getByText('AddPrimaryContact')).toBeTruthy();
    expect(screen.getByText('Showing 4 of 6 objects')).toBeTruthy();
  });

  it('keeps types that are still loading or failed to load visible when hiding empty types', () => {
    setup();

    fireEvent.click(getHideEmptyTypesCheckbox());

    expect(screen.getByText('Visualforce Pages')).toBeTruthy();
    expect(screen.getByText('Apex Triggers')).toBeTruthy();
    expect(screen.getByText('Error loading metadata')).toBeTruthy();
  });
});
