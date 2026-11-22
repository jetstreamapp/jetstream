import { describe, expect, it, vi } from 'vitest';

// The ui barrel transitively loads modules that fetch the user profile at import time
vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {},
}));

import { DataTableGenericContext } from '@jetstream/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionRenderer } from '../permission-manager-table-utils';

const row = {
  key: 'Account.Name',
  sobject: 'Account',
  apiName: 'Name',
  label: 'Name',
  tableLabel: 'Name (Name)',
  allowEditPermission: true,
  permissions: {},
};

function renderRowAction(commitEdit = vi.fn()) {
  render(
    <DataTableGenericContext.Provider value={{ type: 'field' }}>
      <button type="button">Before grid</button>
      <RowActionRenderer {...({ row, commitEdit } as any)} />
      <button type="button">After grid</button>
    </DataTableGenericContext.Provider>,
  );
  return commitEdit;
}

async function openEditRow() {
  const trigger = screen.getByRole('button', { name: 'Edit Row' });
  trigger.focus();
  await act(async () => {
    fireEvent.click(trigger);
  });
  const dialog = await screen.findByRole('dialog', { name: 'Apply change to row' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return { trigger, dialog };
}

describe('RowActionRenderer (Edit Row popover)', () => {
  it('keeps Tab and Shift+Tab inside the popover instead of escaping to the page', async () => {
    renderRowAction();
    const { dialog } = await openEditRow();

    // Close button, two checkboxes, Reset Row, Apply to Row: two full laps in each direction
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      // Wrapping passes through a focus guard, so the landing spot settles a tick later
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    }
    for (let i = 0; i < 10; i++) {
      await userEvent.tab({ shift: true });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    }
    expect(screen.getByRole('dialog', { name: 'Apply change to row' })).toBeTruthy();
  });

  it('stays open with focus inside after applying, so Tab cannot drop focus to the page', async () => {
    const commitEdit = renderRowAction();
    const { dialog } = await openEditRow();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Read' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to Row' }));
    expect(commitEdit).toHaveBeenCalledTimes(1);

    await userEvent.tab();

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(screen.getByRole('dialog', { name: 'Apply change to row' })).toBeTruthy();
  });

  it('returns focus to the Edit Row button when closed with Escape', async () => {
    renderRowAction();
    const { trigger } = await openEditRow();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    fireEvent.keyUp(document.activeElement as Element, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apply change to row' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
