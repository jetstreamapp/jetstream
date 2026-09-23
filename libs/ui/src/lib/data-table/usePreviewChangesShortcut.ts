import { hasCtrlOrMeta, isEnterKey, isModalDialogOpen, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { useCallback, useEffect, useRef } from 'react';

interface PreviewChangesShortcutOptions {
  hasDirtyRows: boolean;
  isSaving: boolean;
  /** Called on the next tick, so an edit committed by the same press has settled into dirty state first */
  onPreview: () => void;
}

/**
 * Cmd/Ctrl+Enter opens the Preview Changes modal for inline edits (the modal then owns the shortcut to save).
 *
 * The key is only claimed when there is something to preview — dirty rows, a save in flight, or a press from
 * inside an open cell editor (which commits that edit first, so it may be the table's first change). Otherwise
 * it is left for the page, where Query Results re-runs the query. Stands down entirely while any modal is open:
 * this listener is registered first, so claiming the key there would keep a modal's own Cmd/Ctrl+Enter
 * (saving the record opened from a row) from ever firing.
 */
export function usePreviewChangesShortcut({ hasDirtyRows, isSaving, onPreview }: PreviewChangesShortcutOptions) {
  // A live ref (updated in an effect, never during render) lets the stable global handler read the latest state
  const latestRef = useRef({ hasDirtyRows, isSaving, onPreview });
  useEffect(() => {
    latestRef.current = { hasDirtyRows, isSaving, onPreview };
  });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnterKey(event as any) || !hasCtrlOrMeta(event as any) || isModalDialogOpen()) {
      return;
    }
    const isFromCellEditor = event.target instanceof Element && !!event.target.closest('.jgrid-editor');
    if (!latestRef.current.hasDirtyRows && !latestRef.current.isSaving && !isFromCellEditor) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => latestRef.current.onPreview());
  }, []);

  useGlobalEventHandler('keydown', handleKeyDown);
}
