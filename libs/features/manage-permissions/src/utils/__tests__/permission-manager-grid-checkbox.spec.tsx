import { PermissionTableObjectCell } from '@jetstream/types';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getObjectColumns } from '../permission-manager-table-utils';

const profilesById = { profile1: { Profile: { Name: 'Admin' } } } as never;
const permissionSetsById = { managedSet1: { Name: 'Managed Set' } } as never;

function buildRow(overrides: Partial<PermissionTableObjectCell> = {}): PermissionTableObjectCell {
  return {
    key: 'Account',
    sobject: 'Account',
    apiName: 'Account',
    label: 'Account',
    tableLabel: 'Account (Account)',
    allowEditPermission: true,
    allowViewAllModifyAllPermission: true,
    allowObjectPermission: true,
    permissions: {
      profile1: { read: true, viewAll: false },
      managedSet1: { read: false, isReadOnly: true },
    },
    ...overrides,
  } as PermissionTableObjectCell;
}

/** Renders the grid cell for one column the way the data table would and returns its checkbox */
function renderCheckbox(columnKey: string, row: PermissionTableObjectCell) {
  const columns = getObjectColumns(['profile1'], ['managedSet1'], profilesById, permissionSetsById, new Set(['managedSet1']));
  const column = columns.find(({ key }) => key === columnKey);
  if (!column?.renderCell) {
    throw new Error(`No renderCell for column ${columnKey}`);
  }
  const { container } = render(<>{(column.renderCell as any)({ row, commitEdit: vi.fn() })}</>);
  return container.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('permission grid checkbox cells', () => {
  it('names each checkbox with the permission, the row and the profile it belongs to', () => {
    const checkbox = renderCheckbox('profile1-read', buildRow());

    expect(checkbox.getAttribute('aria-label')).toBe('Read Account for Admin (Profile)');
  });

  it('is an inner-focus target for grid keyboard navigation when it can be toggled', () => {
    const checkbox = renderCheckbox('profile1-read', buildRow());

    expect(checkbox.disabled).toBe(false);
    expect(checkbox.hasAttribute('data-grid-inner-focus')).toBe(true);
  });

  it('is not an inner-focus target when the cell is read-only (managed permission set)', () => {
    const checkbox = renderCheckbox('managedSet1-read', buildRow());

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.hasAttribute('data-grid-inner-focus')).toBe(false);
  });

  it('is not an inner-focus target when View All / Modify All is unsupported for the object', () => {
    const checkbox = renderCheckbox('profile1-viewAll', buildRow({ allowViewAllModifyAllPermission: false }));

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.hasAttribute('data-grid-inner-focus')).toBe(false);
  });
});
