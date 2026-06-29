import { ClassNames, type ClassNamesContent } from '@emotion/react';
import { ColorScheme } from '@jetstream/types';
import EditorImpl, { DiffEditor as DiffEditorImpl, DiffEditorProps, EditorProps } from '@monaco-editor/react';
import { useMemo, useSyncExternalStore } from 'react';

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

function computeMonacoTheme(): 'vs' | 'vs-dark' {
  return resolveScheme(getBodyColorScheme()) === 'dark' ? 'vs-dark' : 'vs';
}

/**
 * All Monaco editors share ONE body-class `MutationObserver` and ONE
 * `prefers-color-scheme` listener via `useSyncExternalStore`, rather than each
 * editor instance registering its own. The Query History modal can mount dozens
 * of editors at once, so a per-instance observer/listener would scale linearly
 * for no benefit — Monaco's theme is global, so the value is identical for every
 * editor. The shared store is set up lazily on the first subscriber and torn
 * down when the last editor unmounts.
 */
const themeListeners = new Set<() => void>();
let currentTheme: 'vs' | 'vs-dark' = computeMonacoTheme();
let bodyObserver: MutationObserver | null = null;
let schemeMediaQuery: MediaQueryList | null = null;

function recomputeTheme() {
  const nextTheme = computeMonacoTheme();
  if (nextTheme !== currentTheme) {
    currentTheme = nextTheme;
    themeListeners.forEach((listener) => listener());
  }
}

function subscribeToTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  if (themeListeners.size === 1 && typeof document !== 'undefined') {
    // Catch up to the live body state in case the class changed between module
    // load and the first editor mounting, then start watching for changes.
    currentTheme = computeMonacoTheme();
    bodyObserver = new MutationObserver(recomputeTheme);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    schemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    schemeMediaQuery.addEventListener('change', recomputeTheme);
  }
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0) {
      bodyObserver?.disconnect();
      bodyObserver = null;
      schemeMediaQuery?.removeEventListener('change', recomputeTheme);
      schemeMediaQuery = null;
    }
  };
}

function useMonacoTheme(): 'vs' | 'vs-dark' {
  return useSyncExternalStore(
    subscribeToTheme,
    () => currentTheme,
    () => 'vs',
  );
}

/**
 * Monaco's light theme background is the same white as the page, so a light-mode
 * editor bleeds into its surroundings with no visible edge. A border gives it a
 * defined boundary. The `--slds-g-color-border-1` token is scheme-aware, so the
 * border also stays appropriate in dark mode, and the `--slds-g-radius-border-1`
 * radius matches the SLDS 2 input/box motif. Applied to Monaco's own wrapper
 * `<section>` via `wrapperProps` (rather than an extra wrapping element) to avoid
 * disturbing the height: 100% layouts that many call sites rely on.
 *
 * `overflow: hidden` clips Monaco's square-cornered content `<div>` to the radius
 * — without it the content background paints into the corners and the rounded
 * border looks "cut off." The clip would normally also crop autocomplete/hover
 * widgets that extend past the editor edge, so `useEditorOptions` defaults
 * Monaco's `fixedOverflowWidgets` option on, rendering those widgets in a
 * body-level container that escapes the clip.
 */
function buildEditorBorderWrapperProps<T extends { className?: string }>(
  css: ClassNamesContent['css'],
  cx: ClassNamesContent['cx'],
  wrapperProps: T | undefined,
) {
  const borderClassName = css`
    border: 1px solid var(--slds-g-color-border-1, #dddbda);
    border-radius: var(--slds-g-radius-border-1, 0.25rem);
    overflow: hidden;
  `;
  return {
    ...wrapperProps,
    className: cx(borderClassName, wrapperProps?.className),
  };
}

/**
 * Defaults `fixedOverflowWidgets` on so autocomplete/hover widgets are not
 * clipped by the wrapper's `overflow: hidden`. Caller-supplied options win.
 *
 * Memoized on the caller's `options` reference: `@monaco-editor/react` calls
 * `editor.updateOptions` in a `useEffect([options])`, so returning a fresh object
 * every render would force an `updateOptions` on every parent re-render.
 */
function useEditorOptions<T extends { fixedOverflowWidgets?: boolean }>(options: T | undefined): T {
  return useMemo(() => ({ fixedOverflowWidgets: true, ...options }) as T, [options]);
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
  const options = useEditorOptions(props.options);
  return (
    <ClassNames>
      {({ css, cx }) => (
        <EditorImpl {...props} theme={theme} options={options} wrapperProps={buildEditorBorderWrapperProps(css, cx, props.wrapperProps)} />
      )}
    </ClassNames>
  );
}

export function MonacoDiffEditor(props: DiffEditorProps) {
  const theme = useMonacoTheme();
  const options = useEditorOptions(props.options);
  return (
    <ClassNames>
      {({ css, cx }) => (
        <DiffEditorImpl
          {...props}
          theme={theme}
          options={options}
          wrapperProps={buildEditorBorderWrapperProps(css, cx, props.wrapperProps)}
        />
      )}
    </ClassNames>
  );
}

export default MonacoEditor;
