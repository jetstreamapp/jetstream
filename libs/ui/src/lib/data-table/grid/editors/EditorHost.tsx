/* eslint-disable @typescript-eslint/no-explicit-any */
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import type { Table } from '@tanstack/react-table';
import { useState } from 'react';
import { OutsideClickHandler } from '../../../utils/OutsideClickHandler';
import { ActiveCell } from '../components/GridRow';
import { ColumnWithFilter } from '../grid-types';

export interface EditorHostProps<TRow> {
  editingCell: ActiveCell;
  table: Table<TRow>;
  /** Returns the grid root so the anchor cell can be located + scoped. */
  getRootElement: () => HTMLElement | null;
  /** Apply an edited row and let the consumer persist it. */
  onCommitRow: (updatedRow: TRow, rowId: string, column: ColumnWithFilter<TRow>) => void;
  /** Close the editor; `commit` is advisory, `focusCell` returns focus to the cell. */
  onClose: (commit?: boolean, focusCell?: boolean) => void;
}

/**
 * Renders the active column's `renderEditCell` in a popover anchored to the live cell via floating-ui.
 * This replaces the legacy `document.querySelector('[aria-rowindex][aria-colindex]')` positioning,
 * eliminating the filtered-index reconciliation that approach required.
 *
 * Edits accumulate on a DRAFT row (mirroring react-data-grid's internal editor row): editors call
 * `onRowChange(row)` per change, but the consumer's `onRowsChange` only fires once when the edit
 * commits (Enter/Tab/blur/outside click) — never per keystroke — and Escape discards the draft.
 * GridContainer keys this component by cell so the draft resets when editing moves to another cell.
 */
export function EditorHost<TRow>({ editingCell, table, getRootElement, onCommitRow, onClose }: EditorHostProps<TRow>) {
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();
  const rowIndex = rows.findIndex((row) => row.id === editingCell.rowId);
  const colIndex = columns.findIndex((column) => column.id === editingCell.columnId);
  const row = rows[rowIndex];
  const column = columns[colIndex];
  const authorColumn = column?.columnDef.meta?.jetstream?.column as ColumnWithFilter<TRow> | undefined;

  const [draftRow, setDraftRow] = useState<TRow | null>(null);

  const cellEl =
    getRootElement()?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(editingCell.rowId)}"][data-col-id="${CSS.escape(editingCell.columnId)}"]`,
    ) ?? null;

  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    elements: { reference: cellEl ?? undefined },
    // Overlay the editor on top of the cell (negative offset == cell height).
    middleware: [offset(({ rects }) => -rects.reference.height), flip(), shift({ padding: 4 })],
  });

  if (!row || !authorColumn?.renderEditCell || !cellEl) {
    return null;
  }

  const minWidth = Math.max(cellEl.offsetWidth, 200);

  // Name the editor dialog so screen readers announce the column being edited instead of a bare "dialog".
  const editorColumnName = typeof authorColumn.name === 'string' ? authorColumn.name : undefined;

  const handleRowChange = (updatedRow: TRow, commit?: boolean) => {
    if (commit) {
      onCommitRow(updatedRow, editingCell.rowId, authorColumn);
      onClose(true, true);
    } else {
      setDraftRow(updatedRow);
    }
  };

  const handleClose = (commit?: boolean, focusCell?: boolean) => {
    if (commit && draftRow !== null) {
      onCommitRow(draftRow, editingCell.rowId, authorColumn);
    }
    onClose(commit, focusCell);
  };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        role="dialog"
        aria-label={editorColumnName ? `Edit ${editorColumnName}` : 'Edit cell'}
        className="slds-popover slds-popover_edit jgrid-editor"
        style={{ ...floatingStyles, zIndex: 9050, minWidth }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            handleClose(false, true);
          } else if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            handleClose(true, true);
          } else if (event.key === 'Enter' && !event.defaultPrevented) {
            // Comboboxes/pickers own Enter (it selects an option and they commit through onRowChange);
            // for plain inputs Enter commits the draft and closes, matching the legacy grid.
            const target = event.target as HTMLElement;
            if (!target.closest('[role="combobox"], [role="listbox"], .slds-datepicker')) {
              event.preventDefault();
              handleClose(true, true);
            }
          }
        }}
      >
        {/* Clicking anywhere outside the editor dismisses it (focusCell=false so the click's own target
            keeps focus — e.g. another cell). A dirty draft commits on dismiss — the outside mousedown
            unmounts the editor before its input's blur handler can run, so this is the blur-commit path.
            Inline editor dropdowns render inside this subtree, so selecting an option does not count as
            an outside click. */}
        <OutsideClickHandler
          className="slds-p-around_x-small"
          onOutsideClick={() => handleClose(draftRow !== null ? true : (authorColumn.editorOptions?.commitOnOutsideClick ?? false), false)}
        >
          {authorColumn.renderEditCell({
            row: draftRow ?? row.original,
            column: authorColumn,
            rowIndex,
            colIndex,
            onRowChange: handleRowChange,
            onClose: handleClose,
          })}
        </OutsideClickHandler>
      </div>
    </FloatingPortal>
  );
}
