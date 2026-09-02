/**
 * What Enter does on a focused body cell, spelled out for screen readers. Screen readers announce a
 * gridcell's content but nothing about the editor, control or link behind it, so GridBody points the
 * focused cell's aria-describedby at one of these (rendered once per grid by GridContainer as hidden
 * text). The kinds mirror the branches of the grid's Enter handling: an editable cell opens its editor;
 * otherwise a lone checkbox/control is activated, a lone text field is entered, and a cell with several
 * controls switches to Actionable mode.
 */
export type CellHintKind = 'editable' | 'checkbox' | 'expand' | 'link' | 'input' | 'control' | 'controls';

export const CELL_HINT_TEXT: Record<CellHintKind, string> = {
  editable: 'Editable. Press Enter to edit.',
  checkbox: 'Press Enter to toggle the checkbox.',
  expand: 'Expandable row. Press Enter to expand or collapse it.',
  link: 'Contains a link. Press Enter to open it.',
  input: 'Press Enter to type in the field and Escape to return to the cell.',
  control: 'Contains a control. Press Enter to activate it.',
  controls: 'Contains controls. Press Enter to move to them and Escape to return to the cell.',
};

export const CELL_HINT_KINDS = Object.keys(CELL_HINT_TEXT) as CellHintKind[];

export function getCellHintId(gridId: string, kind: CellHintKind) {
  return `${gridId}-hint-${kind}`;
}
