/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// The `@jetstream/ui` barrel pulls in a drag-and-drop dependency that reads `ResizeObserver` at module evaluation
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    } as unknown as typeof ResizeObserver;
  }
});

// Loading the real app state starts requests to the server
vi.mock('@jetstream/ui/app-state', () => ({}));

import type { RenderCellProps } from '@jetstream/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryActivationStateRenderer, HistoryItemStatusRenderer } from '../automation-control-table-renderers';
import { HistoryItemRow } from '../automation-control-types';

function buildRow(overrides: Partial<HistoryItemRow> = {}): HistoryItemRow {
  return {
    key: 'ValidationRule_1',
    type: 'ValidationRule',
    typeLabel: 'Validation Rule',
    fullName: 'Account.Require_Phone',
    sobject: 'Account',
    label: 'Require_Phone',
    previous: { isActive: true, activeVersionNumber: null },
    deployed: { isActive: false, activeVersionNumber: null },
    status: 'success',
    errorMessage: null,
    ...overrides,
  };
}

function cellProps(row: HistoryItemRow, columnKey = 'status') {
  return { row, column: { key: columnKey } } as unknown as RenderCellProps<HistoryItemRow, unknown>;
}

describe('History result cells', () => {
  it('names the copy-error button after the item', () => {
    render(<>{HistoryItemStatusRenderer(cellProps(buildRow({ status: 'error', errorMessage: 'Field is required' })))}</>);

    expect(screen.getByRole('button', { name: 'Copy error for Require_Phone' })).toBeTruthy();
  });

  it('reads a status once, and explains a result that was not confirmed', () => {
    const { container, unmount } = render(<>{HistoryItemStatusRenderer(cellProps(buildRow({ status: 'success' })))}</>);
    expect(container.textContent).toBe('Success');
    unmount();

    const { container: incompleteContainer } = render(<>{HistoryItemStatusRenderer(cellProps(buildRow({ status: 'incomplete' })))}</>);
    expect(incompleteContainer.textContent).toBe(
      'Not confirmed. The deployment did not finish, so this change may or may not have been applied.',
    );
  });

  it('names the read-only activation checkboxes by column', () => {
    render(
      <>
        {HistoryActivationStateRenderer(cellProps(buildRow(), 'previous'))}
        {HistoryActivationStateRenderer(cellProps(buildRow(), 'deployed'))}
      </>,
    );

    expect(screen.getByRole('checkbox', { name: 'Active before' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Active after' })).toBeTruthy();
  });
});
