import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useJetstreamTable } from '../core/useJetstreamTable';
import { EditorHost } from '../editors/EditorHost';
import { ColumnWithFilter, DataTableEditorProps } from '../grid-types';

interface Row {
  _key: string;
  Id: string;
  Name: string;
}

const data: Row[] = [
  { _key: '1', Id: '001', Name: 'Charlie' },
  { _key: '2', Id: '002', Name: 'Alpha' },
];

/** Mirrors EditorText: a hookless editor, as columns have before field metadata resolves. */
function EditorNoHooks({ row, onRowChange }: DataTableEditorProps<Row>) {
  return (
    <input data-testid="editor-no-hooks" value={row.Name || ''} onChange={(event) => onRowChange({ ...row, Name: event.target.value })} />
  );
}

/** Mirrors EditorRecordLookup/editorDropdown: an editor with hook state. */
function EditorWithHooks({ row }: DataTableEditorProps<Row>) {
  const [initialValue] = useState(() => row.Name);
  return <div data-testid="editor-with-hooks">{initialValue}</div>;
}

function buildColumns(renderEditCell: ColumnWithFilter<Row>['renderEditCell']): ColumnWithFilter<Row>[] {
  return [
    { key: 'Id', name: 'Id' },
    { key: 'Name', name: 'Name', editable: true, renderEditCell },
  ];
}

function Harness({ columns, getRootElement }: { columns: ColumnWithFilter<Row>[]; getRootElement: () => HTMLElement | null }) {
  const { table } = useJetstreamTable<Row>({ data, columns, getRowKey: (row) => row._key });
  return (
    <EditorHost
      editingCell={{ rowId: '1', columnId: 'Name' }}
      table={table}
      getRootElement={getRootElement}
      onCommitRow={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

/** EditorHost anchors to the live cell via `[data-row-id][data-col-id]`, so provide one. */
function createGridRoot(): HTMLElement {
  const root = document.createElement('div');
  const cell = document.createElement('div');
  cell.setAttribute('data-row-id', '1');
  cell.setAttribute('data-col-id', 'Name');
  root.appendChild(cell);
  document.body.appendChild(root);
  return root;
}

describe('EditorHost', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('swapping to a hook-bearing editor mid-edit remounts the editor instead of crashing (React #310 regression)', () => {
    const root = createGridRoot();
    const { rerender } = render(<Harness columns={buildColumns(EditorNoHooks)} getRootElement={() => root} />);

    // Draft an edit through the hookless editor, mirroring a user typing before metadata resolves.
    fireEvent.change(screen.getByTestId('editor-no-hooks'), { target: { value: 'Drafted value' } });

    // Field metadata resolving rebuilds columns, swapping in a hook-bearing editor mid-edit. When the
    // editor was invoked as a plain function its hooks lived on EditorHost's fiber, so this rerender
    // threw "Rendered more hooks than during the previous render" (React #310).
    rerender(<Harness columns={buildColumns(EditorWithHooks)} getRootElement={() => root} />);

    // The new editor mounted and received the in-progress draft (draft state lives on EditorHost).
    expect(screen.getByTestId('editor-with-hooks').textContent).toBe('Drafted value');
  });
});
