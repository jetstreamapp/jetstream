import type { EditorProps } from '@monaco-editor/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The wrapper subscribes to `prefers-color-scheme`, which jsdom does not implement
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

const editorPropsSpy = vi.fn();

// Stand in for the real editor so the wrapper's options/onMount wiring can be inspected without
// loading Monaco (which needs workers and layout that jsdom does not provide)
vi.doMock('@monaco-editor/react', () => ({
  __esModule: true,
  default: (props: EditorProps & { wrapperProps?: Record<string, unknown> }) => {
    editorPropsSpy(props);
    return (
      <div {...props.wrapperProps}>
        <div data-testid="editor" />
      </div>
    );
  },
  DiffEditor: (props: EditorProps) => {
    editorPropsSpy(props);
    return <div data-testid="diff-editor" />;
  },
}));

vi.doMock('../settings/editor-screen-reader-mode', () => ({
  getEditorAccessibilitySupport: () => 'auto',
}));

const { MonacoEditor } = await import('../MonacoEditor');

/** Props the wrapper handed the editor on its most recent render */
function lastEditorProps(): EditorProps {
  const props = editorPropsSpy.mock.calls.at(-1)?.[0];
  if (!props) {
    throw new Error('The editor was never rendered');
  }
  return props as EditorProps;
}

/** Minimal stand-in for the editor object Monaco hands to `onMount` */
function mountEditor(domNode: HTMLElement, selectionCount = 1) {
  lastEditorProps().onMount?.(
    { getDomNode: () => domNode, getSelections: () => Array.from({ length: selectionCount }, () => ({})) } as never,
    {} as never,
  );
}

function pressEscape(shiftKey = false) {
  fireEvent.keyDown(screen.getByTestId('editor'), { key: 'Escape', shiftKey });
}

describe('MonacoEditor', () => {
  beforeEach(() => {
    editorPropsSpy.mockClear();
    document.body.innerHTML = '';
  });

  it('advertises the escape affordance in the accessible name, since Tab is captured by the editor', () => {
    render(<MonacoEditor />);
    const { options } = lastEditorProps();
    expect(options?.ariaLabel).toBe('Code editor. Press Escape to move focus out of the editor, or Shift + Escape to move back.');
  });

  it("keeps the caller's name and appends the affordance to it", () => {
    render(<MonacoEditor options={{ ariaLabel: 'Apex code' }} />);
    const { options } = lastEditorProps();
    expect(options?.ariaLabel).toBe('Apex code. Press Escape to move focus out of the editor, or Shift + Escape to move back.');
  });

  // The button that runs it sits in the card header, before the editor in the tab order, so the
  // shortcut has to be announced where the user actually is
  it('announces the primary action shortcut with spoken key names, not glyphs', () => {
    render(<MonacoEditor label="Anonymous Apex code" primaryActionLabel="execute the code" />);
    const { options } = lastEditorProps();

    expect(options?.ariaLabel).toMatch(/^Anonymous Apex code\. Press (Command|Control) \+ Enter to execute the code\./);
    expect(options?.ariaLabel).toContain('Press Escape to move focus out of the editor');
    expect(options?.ariaLabel).not.toContain('⌘');
  });

  it('omits the action sentence for an editor with no primary action', () => {
    render(<MonacoEditor label="Apex execution log" />);
    const { options } = lastEditorProps();
    expect(options?.ariaLabel).toBe('Apex execution log. Press Escape to move focus out of the editor, or Shift + Escape to move back.');
  });

  it('leaves Escape to Monaco while one of its widgets is open, so it still closes autocomplete first', () => {
    document.body.innerHTML = `<button id="after">Execute</button>`;
    const editorNode = document.createElement('div');
    editorNode.className = 'monaco-editor';
    editorNode.innerHTML = `<div class="suggest-widget visible"></div>`;

    render(<MonacoEditor />);
    mountEditor(editorNode);
    pressEscape();

    expect(document.activeElement?.id).not.toBe('after');
  });

  it('leaves Escape to Monaco while there are extra cursors to collapse', () => {
    document.body.innerHTML = `<button id="after">Execute</button>`;

    render(<MonacoEditor />);
    mountEditor(document.createElement('div'), 2);
    pressEscape();

    expect(document.activeElement?.id).not.toBe('after');
  });

  // Monaco reclaims its textarea while handling the same keydown, so the move has to happen in the
  // capture phase, before Monaco sees the key at all
  it('moves focus to the next control outside the editor on Escape', () => {
    document.body.innerHTML = `<div id="host"></div><button id="after">Execute</button>`;
    const editorNode = document.createElement('div');
    (document.getElementById('host') as HTMLElement).appendChild(editorNode);

    render(<MonacoEditor />);
    mountEditor(editorNode);
    pressEscape();

    expect(document.activeElement?.id).toBe('after');
  });

  // Leaving only forwards is a one-way valve: shift-tabbing back from the next control lands inside
  // the editor again, so everything before it would need a full cycle of the page to reach
  it('moves focus to the previous control before the editor on Shift+Escape', () => {
    document.body.innerHTML = `<button id="before">Submit</button><div id="host"></div><button id="after">Copy</button>`;
    const editorNode = document.createElement('div');
    (document.getElementById('host') as HTMLElement).appendChild(editorNode);

    render(<MonacoEditor />);
    mountEditor(editorNode);
    pressEscape(true);

    expect(document.activeElement?.id).toBe('before');
  });

  it('announces both directions, since Monaco captures Shift+Tab as outdent', () => {
    render(<MonacoEditor label="Formula" />);
    const { options } = lastEditorProps();
    expect(options?.ariaLabel).toContain('Shift + Escape to move back');
  });

  it("still runs the caller's own onMount", () => {
    const onMount = vi.fn();
    render(<MonacoEditor onMount={onMount} />);
    mountEditor(document.createElement('div'));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onMount.mock.calls[0][0].getDomNode).toBeTypeOf('function');
  });
});
