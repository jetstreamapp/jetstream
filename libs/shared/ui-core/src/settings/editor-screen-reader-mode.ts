const STORAGE_KEY = 'jetstream-editor-screen-reader-mode';

/**
 * Browsers deliberately expose no "screen reader active" signal, so Monaco's screen-reader mode
 * cannot be auto-detected on the web — it is an explicit user opt-in (Settings > Editor), the same
 * approach VS Code for the Web takes. 'auto' keeps Monaco's own best-effort platform detection for
 * everyone else. Applies to editors mounted after the setting changes.
 *
 * Both halves of the storage protocol live here (MonacoEditor reads, EditorSettingsSection writes)
 * so the key and its string encoding stay a private detail of this module.
 */
export function getEditorAccessibilitySupport(): 'on' | 'auto' {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true' ? 'on' : 'auto';
  } catch {
    return 'auto';
  }
}

export function setEditorScreenReaderMode(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // storage unavailable - the setting simply will not persist
  }
}
