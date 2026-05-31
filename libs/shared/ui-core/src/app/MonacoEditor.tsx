import { ColorScheme } from '@jetstream/types';
import EditorImpl, { DiffEditor as DiffEditorImpl, DiffEditorProps, EditorProps } from '@monaco-editor/react';
import { useEffect, useState } from 'react';

const SCHEME_CLASS_PREFIX = 'slds-color-scheme--';

/**
 * Reads the color scheme stamped on `document.body` by `ThemeApplier`
 * (web/desktop/canvas) or `ExtensionThemeApplier` (browser extension). The body
 * class is the single cross-platform source of truth — each platform stores the
 * preference differently (localforage vs. chrome.storage), but they all resolve
 * to the same `slds-color-scheme--*` class — so Monaco follows the same theme as
 * the rest of the app everywhere.
 */
function getBodyColorScheme(): ColorScheme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  const { classList } = document.body;
  if (classList.contains(`${SCHEME_CLASS_PREFIX}dark`)) {
    return 'dark';
  }
  if (classList.contains(`${SCHEME_CLASS_PREFIX}system`)) {
    return 'system';
  }
  return 'light';
}

/**
 * Resolves a color scheme (light/dark/system) to a concrete 'light' or 'dark'
 * that maps directly to a Monaco theme name.
 */
function resolveScheme(scheme: ColorScheme): 'light' | 'dark' {
  if (scheme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return scheme;
}

function useMonacoTheme(): 'vs' | 'vs-dark' {
  const [scheme, setScheme] = useState<ColorScheme>(getBodyColorScheme);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveScheme(getBodyColorScheme()));

  useEffect(() => {
    setResolved(resolveScheme(scheme));
  }, [scheme]);

  // The theme appliers swap the body's slds-color-scheme--* class when the
  // preference changes; watch for it so editors re-theme without a remount.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const observer = new MutationObserver(() => setScheme(getBodyColorScheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // When following the OS, track prefers-color-scheme changes directly.
  useEffect(() => {
    if (scheme !== 'system' || typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [scheme]);

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
