import { useEffect, useRef } from 'react';
import { disposeEditorRefs } from '../shared-ui-utils';

interface Disposable {
  dispose(): void;
}

/**
 * Hook to manage disposables, particularly for monaco editor instances. It provides a way to add disposables and ensures they are cleaned up when the component unmounts.
 *
 * Example usage:
 * const { addDisposable } = useDisposables();
 * const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
 *
 * NOTE: Only use this for disposables that are created within the component and do not need to be disposed of until entire component unmount.
 * For disposables created in an effect or callback, the component should manage those disposables directly within the effect or callback to ensure proper cleanup.
 */
export function useDisposables() {
  const editorRefDisposables = useRef<Disposable[]>([]);

  useEffect(() => {
    const disposables = editorRefDisposables.current;
    return () => {
      disposeEditorRefs(disposables);
    };
  }, []);

  const addDisposable = (disposable: Disposable) => {
    editorRefDisposables.current.push(disposable);
  };

  return { addDisposable };
}
