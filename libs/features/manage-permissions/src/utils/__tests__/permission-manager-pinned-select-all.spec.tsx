import { DataTableGenericContext } from '@jetstream/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PinnedSelectAllRendererWrapper } from '../permission-manager-table-utils';

function renderWrapper(context: Record<string, unknown>) {
  render(
    <DataTableGenericContext.Provider value={context}>
      <PinnedSelectAllRendererWrapper {...({ column: { key: 'abc-read' } } as any)} contextLabel="Read for Admin (Profile)" />
    </DataTableGenericContext.Provider>,
  );
}

describe('PinnedSelectAllRendererWrapper', () => {
  it('applies the column action and announces which column it acted on', () => {
    const onColumnAction = vi.fn();
    const announce = vi.fn();
    renderWrapper({ onColumnAction, announce });

    fireEvent.click(screen.getByRole('button', { name: /^Select all visible rows/ }));

    expect(onColumnAction).toHaveBeenCalledWith('selectAll', 'abc-read');
    expect(announce).toHaveBeenCalledWith('Selected all visible rows: Read for Admin (Profile)');
  });

  // The Setup Entity Access table builds its context with a cast and once omitted `announce`
  it('still applies the column action when the table provides no announcer', () => {
    const onColumnAction = vi.fn();
    renderWrapper({ onColumnAction });

    // React reports an error thrown in an event handler on `window` rather than rethrowing it to the caller
    const onUncaughtError = vi.fn((event: ErrorEvent) => event.preventDefault());
    window.addEventListener('error', onUncaughtError);
    fireEvent.click(screen.getByRole('button', { name: /^Reset visible rows/ }));
    window.removeEventListener('error', onUncaughtError);

    expect(onUncaughtError).not.toHaveBeenCalled();
    expect(onColumnAction).toHaveBeenCalledWith('reset', 'abc-read');
  });
});
