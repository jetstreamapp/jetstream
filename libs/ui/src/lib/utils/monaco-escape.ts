/**
 * Monaco state that Escape must resolve before the press means anything to the surrounding UI
 * (closing a layer, leaving the editor): its own overlays, extra cursors, and a non-empty selection —
 * the last two collapse on Escape.
 *
 * Matched in the DOM rather than through Monaco's context keys because the callers run in the
 * CAPTURE phase, before Monaco sees the key at all.
 */
const MONACO_ESCAPE_OWNER_SELECTOR = [
  '.suggest-widget.visible',
  '.parameter-hints-widget.visible',
  '.find-widget.visible',
  '.monaco-hover:not(.hidden)',
  '.rename-box',
  '.snippet-placeholder',
  '.cursor-secondary',
  // Monaco draws a non-empty selection as these overlay nodes (only for lines in view)
  '.selected-text',
].join(', ');

/**
 * Whether an Escape keydown aimed at `target` belongs to Monaco: the target sits inside a Monaco editor
 * that has an overlay open (autocomplete, parameter hints, find, hover, rename, snippet), more than one
 * cursor or selected text. Monaco dismisses that state itself and stops the event, so a capture-phase Escape handler
 * — a closing layer, the editor's own "leave" affordance — must stand down for that press.
 */
export function monacoEditorOwnsEscape(target: EventTarget | null | undefined): boolean {
  const editorNode = target instanceof Element ? target.closest('.monaco-editor') : null;
  return !!editorNode?.querySelector(MONACO_ESCAPE_OWNER_SELECTOR);
}
