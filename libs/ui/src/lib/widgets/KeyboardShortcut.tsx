import { css } from '@emotion/react';
import { Fragment, ReactNode } from 'react';
import Grid, { GridProps } from '../grid/Grid';

export function getModifierKey() {
  return typeof navigator === 'object' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'CTRL';
}

// The visual glyphs read terribly (or not at all) in screen readers — '⌘' announces as
// "place of interest sign" at best
const SPOKEN_KEYS: Record<string, string> = {
  '⌘': 'Command',
  CTRL: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  option: 'Option',
  shift: 'Shift',
  enter: 'Enter',
  esc: 'Escape',
  'right-click': 'right click',
  click: 'click',
};

export function getSpokenKeyboardShortcut(keys: string[]) {
  return keys.map((key) => SPOKEN_KEYS[key] ?? key).join(' + ');
}

/**
 * `aria-keyshortcuts` value for a control whose shortcut is shown visually via <KeyboardShortcut />
 * (usually in a tooltip, which is announced too late — the attribute is read at focus time). Takes
 * the same display keys (e.g. `[getModifierKey(), 'enter']`) and maps them to the attribute's
 * canonical key names so visual and announced shortcuts cannot drift. Only pass real keys (not
 * 'click' variants).
 */
export function getAriaKeyshortcuts(keys: string[]): string {
  return keys
    .map((key) => {
      switch (key.toLowerCase()) {
        case '⌘':
        case 'cmd':
        case 'command':
          return 'Meta';
        case 'ctrl':
        case 'control':
          return 'Control';
        case 'option':
          return 'Alt';
        case 'esc':
          return 'Escape';
        default:
          // Single characters stay as-is ("k"); words are capitalized ("shift" -> "Shift").
          return key.length === 1 ? key : key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      }
    })
    .join('+');
}

export interface KeyboardShortcutProps extends GridProps {
  keys: string[];
  preContent?: ReactNode;
  postContent?: ReactNode;
  separator?: ReactNode;
  inverse?: boolean;
}

export function KeyboardShortcut({ keys, preContent, postContent, separator = '+', inverse, ...rest }: KeyboardShortcutProps) {
  const bgColor = inverse
    ? `var(--slds-g-color-surface-container-3, #e5e5e5)`
    : `var(--slds-g-color-surface-container-2, rgba(0, 0, 0, 0.06))`;
  const accentColor = `var(--slds-g-color-border-1, #e5e5e5)`;
  const textColor = `var(--slds-g-color-on-surface-2, rgba(24, 24, 27, 1))`;
  return (
    <Grid verticalAlign="center" {...rest}>
      {preContent && <span className="slds-m-right_x-small">{preContent}</span>}
      <span className="slds-assistive-text">{getSpokenKeyboardShortcut(keys)}</span>
      {keys.map((key, i) => (
        <Fragment key={key}>
          <kbd
            aria-hidden="true"
            className={i === keys.length - 1 ? 'slds-m-right_x-small' : ''}
            css={css`
              align-items: center;
              background-color: ${bgColor};
              border-radius: 0.25rem;
              border: 1px solid ${accentColor};
              box-shadow: ${accentColor};
              box-shadow: inset 0 -1px 0 0 ${accentColor};
              color: ${textColor};
              display: inline-flex;
              font-family:
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                Segoe UI,
                Roboto,
                Helvetica Neue,
                Arial,
                Noto Sans,
                sans-serif,
                Apple Color Emoji,
                Segoe UI Emoji,
                Segoe UI Symbol,
                Noto Color Emoji;
              font-size: 0.75rem;
              height: 1.25rem;
              justify-content: center;
              line-height: 1rem;
              min-width: 1.25rem;
              padding: 0.25rem;
              text-transform: capitalize;
              white-space: nowrap;
              text-transform: uppercase;
            `}
          >
            {key}
          </kbd>
          {i !== keys.length - 1 && (
            <span aria-hidden="true" className="slds-m-horizontal_xx-small">
              {separator}
            </span>
          )}
        </Fragment>
      ))}
      {postContent}
    </Grid>
  );
}
