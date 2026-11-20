import { useState } from 'react';
import { getEditorAccessibilitySupport, setEditorScreenReaderMode } from './editor-screen-reader-mode';
import { SettingsGroup, SettingsToggleRow } from './layout/SettingsSection';

/**
 * Screen-reader mode for the Monaco code editors (SOQL, Apex, API request/response, logs).
 * There is no web API to detect a screen reader, so this is an explicit opt-in — the same approach
 * VS Code for the Web takes. Renders a `SettingsGroup`, so place it inside a `SettingsSection`.
 */
export function EditorSettingsSection() {
  const [screenReaderMode, setScreenReaderMode] = useState(() => getEditorAccessibilitySupport() === 'on');

  function handleChange(value: boolean) {
    setScreenReaderMode(value);
    setEditorScreenReaderMode(value);
  }

  return (
    <SettingsGroup title="Code editors">
      <SettingsToggleRow
        id="editor-screen-reader-mode"
        title="Optimize code editors for screen readers"
        description="Turns on the code editor's screen reader mode (line content announcements and assistive navigation). Applies to editors opened after changing this setting."
        details={
          <p className="slds-text-body_small slds-text-color_weak">
            Inside any code editor: press <kbd>Ctrl</kbd>+<kbd>M</kbd> (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> on Mac) to toggle
            whether <kbd>Tab</kbd> indents or moves focus out of the editor, and <kbd>F1</kbd> to open the command palette and search for
            any other editor command.
          </p>
        }
        checked={screenReaderMode}
        onChange={handleChange}
      />
    </SettingsGroup>
  );
}

export default EditorSettingsSection;
