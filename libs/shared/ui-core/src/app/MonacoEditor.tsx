import { ColorScheme } from '@jetstream/types';
import { useUserPreferenceState } from '@jetstream/ui/app-state';
import EditorImpl, { DiffEditor as DiffEditorImpl, DiffEditorProps, EditorProps } from '@monaco-editor/react';
import { useEffect, useState } from 'react';

/**
 * Resolves the user's color scheme preference (light/dark/system) to a concrete
 * 'light' or 'dark' that maps directly to a Monaco theme name.
 */
function resolveScheme(scheme: ColorScheme | undefined): 'light' | 'dark' {
  const value = scheme ?? 'light';
  if (value === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return value;
}

function useMonacoTheme(): 'vs' | 'vs-dark' {
  const [prefs] = useUserPreferenceState();
  const colorScheme = prefs?.colorScheme;
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveScheme(colorScheme));

  useEffect(() => {
    setResolved(resolveScheme(colorScheme));
  }, [colorScheme]);

  useEffect(() => {
    if (colorScheme !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [colorScheme]);

  return resolved === 'dark' ? 'vs-dark' : 'vs';
}

/**
 * Wrapper around `@monaco-editor/react`'s `<Editor>` that drives the `theme`
 * prop from the user's color scheme preference. The underlying React wrapper
 * defaults `theme` to `"light"` and re-applies it on every editor mount —
 * a global `monaco.editor.setTheme()` call gets clobbered as soon as another
 * editor renders. Passing the prop explicitly is the only reliable approach.
 */
export function MonacoEditor(props: EditorProps) {
  const theme = useMonacoTheme();
  return <EditorImpl {...props} theme={theme} />;
}

export function MonacoDiffEditor(props: DiffEditorProps) {
  const theme = useMonacoTheme();
  return <DiffEditorImpl {...props} theme={theme} />;
}

export default MonacoEditor;
