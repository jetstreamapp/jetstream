import { MouseEvent } from 'react';

interface AriaDisabledButtonProps {
  'aria-disabled': true | undefined;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Props for an action control that must stay focusable while disabled. The native `disabled`
 * attribute drops focus to `<body>` the moment the condition flips under the focused element
 * (e.g. clicking "Next" disables it on the final step), which restarts keyboard navigation from
 * the top of the page. `aria-disabled` keeps focus and announces the state instead; the CSS in
 * `ui-styles/main.css` mirrors SLDS `:disabled` styling for `[aria-disabled='true']`.
 *
 * `aria-disabled` is not enforced by the browser — and the CSS `pointer-events: none` does not
 * block keyboard-initiated clicks — so the click handler is guarded here. Callers must spread
 * these props INSTEAD of attaching their own `onClick`/`aria-disabled`. `preventDefault()` on the
 * disabled path also makes this safe for link-shaped actions.
 */
export function ariaDisabledButtonProps(
  disabled: boolean | undefined,
  onClick: (event: MouseEvent<HTMLElement>) => void,
): AriaDisabledButtonProps {
  return {
    'aria-disabled': disabled || undefined,
    onClick: (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick(event);
    },
  };
}
