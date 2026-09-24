import { css } from '@emotion/react';
import { PositionLeftRight, SizeSmMdLgXlFull } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, RefObject, useEffect, useRef, useState } from 'react';
import { focusContainer } from '../utils/focus-container';
import Icon from '../widgets/Icon';

export interface PanelProps {
  containerClassName?: string;
  heading: string;
  isOpen: boolean;
  fullHeight?: boolean;
  position?: PositionLeftRight;
  size?: SizeSmMdLgXlFull;
  showBackArrow?: boolean;
  /**
   * Close the panel when the user presses Escape. Default: false (opt-in).
   * The listener is attached at the document level (keydown) while isOpen and skips events
   * whose defaultPrevented is set, so nested inputs (Monaco, textareas, comboboxes) that
   * handle Escape locally on keydown can call preventDefault/stopPropagation to keep the panel open.
   */
  closeOnEscape?: boolean;
  /**
   * Close the panel when the user clicks outside of it. Default: false (opt-in).
   * Containment is checked against the panel root, so inline children (comboboxes,
   * pickers, date pickers) are safe. Children that render in a portal (e.g. Popover)
   * fall outside the panel DOM and would close it — avoid enabling this when the panel
   * hosts portaled overlays.
   */
  closeOnOutsideClick?: boolean;
  /**
   * Override the stacking order. Defaults: 8000 when fullHeight (above app chrome
   * and popovers/comboboxes at 7000), 2 otherwise (preserves legacy behavior).
   * Note: fullHeight panels use `position: fixed` and anchor to the viewport.
   */
  zIndex?: number;
  /**
   * The control that opens the panel. Focus returns to it on close when nothing was focused at open
   * time — Safari does not focus a button on mouse click, so `document.activeElement` is `<body>` and
   * there would otherwise be nowhere to return to. A focused element at open time still wins, so a
   * keyboard shortcut used from inside a grid returns to the cell the user was on.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /**
   * Whether opening moves focus into the panel. Default: true. Pass false when the panel opened on its
   * own rather than from a user action (e.g. after a request failed), so it does not pull focus away from
   * wherever the user is working by then. Read when the panel opens.
   */
  focusOnOpen?: boolean;
  onClosed: () => void;
  children?: React.ReactNode;
}

function getPositionClass(position: PositionLeftRight) {
  switch (position) {
    case 'left':
      return 'slds-panel_docked-left';
    case 'right':
      return 'slds-panel_docked-right';
    default:
      return 'slds-panel_docked-left';
  }
}

function getSizeClass(size: SizeSmMdLgXlFull) {
  switch (size) {
    case 'sm':
      return 'slds-size_small';
    case 'md':
      return 'slds-size_medium';
    case 'lg':
      return 'slds-size_large';
    case 'xl':
      return 'slds-size_x-large';
    case 'full':
      return 'slds-size_full';
    default:
      return 'slds-size_medium';
  }
}

export const Panel: FunctionComponent<PanelProps> = ({
  containerClassName,
  heading,
  isOpen,
  fullHeight = true,
  position = 'left',
  size: userSize = 'md',
  showBackArrow,
  closeOnEscape = false,
  closeOnOutsideClick = false,
  zIndex,
  returnFocusTo,
  focusOnOpen = true,
  onClosed,
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusOnOpenRef = useRef(focusOnOpen);

  // Read when the panel opens rather than tracked by the effect below, which would otherwise hand focus
  // back to the opener and re-run whenever the prop changes while the panel is open. Declared first so
  // it has updated the ref by the time that effect runs in the same commit.
  useEffect(() => {
    focusOnOpenRef.current = focusOnOpen;
  }, [focusOnOpen]);

  // Non-modal drawer focus contract: opening moves focus INTO the panel (announcing its heading),
  // closing returns focus to whatever opened it — unless the user closed it by moving focus
  // elsewhere themselves (e.g. an outside click), in which case focus is left alone.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const activeAtOpen = document.activeElement;
    const focusedElementAtOpen = activeAtOpen instanceof HTMLElement && activeAtOpen !== document.body ? activeAtOpen : null;
    returnFocusRef.current = focusedElementAtOpen ?? returnFocusTo?.current ?? null;
    const panelEl = panelRef.current;
    const focusTarget = panelEl?.querySelector<HTMLElement>('[data-panel-focus-target]');
    if (focusTarget && focusOnOpenRef.current) {
      focusContainer(focusTarget);
    }
    return () => {
      const active = document.activeElement;
      const focusWasInsidePanel = !active || active === document.body || !!panelEl?.contains(active);
      const returnTarget = returnFocusRef.current;
      if (focusWasInsidePanel && returnTarget && document.contains(returnTarget)) {
        returnTarget.focus();
        // A landmark the user was on (focused by a route change or the skip link) is only focusable while
        // it holds that focus, so it has to be handed focus the same way again
        if (document.activeElement !== returnTarget) {
          focusContainer(returnTarget);
        }
      }
    };
  }, [isOpen, returnFocusTo]);

  // Escape with focus INSIDE the panel always closes it (a keyboard user must be able to leave the
  // drawer the way they entered); the closeOnEscape prop additionally closes on Escape from anywhere.
  // Callers pass inline onClosed handlers, so it is read through a ref: re-subscribing on every parent
  // render would also forget the last pointer press below.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // A click on the panel's text (or, in Safari, on any of its buttons) leaves focus on <body>, so the
    // last pointer press stands in for focus when deciding whether the user is working in the panel
    let pointerWasInsidePanel = false;
    const trackPointer = (event: PointerEvent) => {
      pointerWasInsidePanel = event.target instanceof Node && !!panelRef.current?.contains(event.target);
    };
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      // Escape already means something to these targets, so the panel waits for the next press: a search
      // box with text clears itself (closing instead threw away the filter AND the panel's unconfirmed
      // selections), and a code editor hands focus on to the control after it
      const { target } = event;
      const isSearchInputWithText = target instanceof HTMLInputElement && target.type === 'search' && !!target.value;
      const isInCodeEditor = target instanceof Element && !!target.closest('.monaco-editor');
      if (isSearchInputWithText || isInCodeEditor) {
        return;
      }
      const active = document.activeElement;
      const focusIsOnBody = !active || active === document.body;
      const focusIsInsidePanel = !focusIsOnBody && !!panelRef.current?.contains(active);
      if (!event.defaultPrevented && (focusIsInsidePanel || (focusIsOnBody && pointerWasInsidePanel))) {
        event.preventDefault();
        event.stopPropagation();
        onClosedRef.current();
      }
    };
    document.addEventListener('pointerdown', trackPointer, { capture: true });
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('pointerdown', trackPointer, { capture: true });
      document.removeEventListener('keydown', handler);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      // Honor defaultPrevented so nested controls that handle Escape locally on keydown — e.g. the
      // Combobox, which closes an open dropdown and calls preventDefault/stopPropagation — get first
      // shot before the panel closes. Nested controls must consume Escape on keydown (not keyup) to
      // preempt this document-level keydown listener.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClosed();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeOnEscape, onClosed]);

  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) {
      return;
    }
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClosed();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeOnOutsideClick, onClosed]);

  if (!isOpen) {
    return null;
  }

  const size: SizeSmMdLgXlFull = expanded ? 'full' : userSize;
  const expandCollapseIcon = expanded ? 'contract_alt' : 'expand_alt';
  const resolvedZIndex = zIndex ?? (fullHeight ? 8000 : 2);

  return (
    <div
      ref={panelRef}
      className={containerClassName}
      css={css`
        z-index: ${resolvedZIndex};
        ${fullHeight ? 'position: fixed; height: 100vh; top: 0;' : ''}
        ${position === 'left' ? 'left: 0' : 'right: 0'};
      `}
    >
      <div
        role="region"
        aria-label={heading}
        data-panel-focus-target
        className={classNames('slds-panel slds-panel_docked slds-is-open', getPositionClass(position), getSizeClass(size))}
        aria-hidden="false"
      >
        <div className="slds-panel__header">
          {showBackArrow && (
            <button
              className="slds-button slds-button_icon slds-button_icon-small slds-panel__back"
              title={`Collapse ${heading}`}
              onClick={() => onClosed()}
            >
              <Icon type="utility" icon="back" className="slds-button__icon" />
              <span className="slds-assistive-text">Collapse {heading}</span>
            </button>
          )}
          <h2 className="slds-panel__header-title slds-text-heading_small slds-truncate" title={heading}>
            {heading}
          </h2>

          <button
            className="slds-button slds-button_icon slds-button_icon-small"
            title={expanded ? `Restore ${heading} size` : `Expand ${heading} to full width`}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon type="utility" icon={expandCollapseIcon} className="slds-button__icon" />
            <span className="slds-assistive-text">{expanded ? `Restore ${heading} size` : `Expand ${heading} to full width`}</span>
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-small slds-panel__close"
            title={`Collapse ${heading}`}
            onClick={() => onClosed()}
          >
            <Icon type="utility" icon="close" className="slds-button__icon" />
            <span className="slds-assistive-text">Collapse {heading}</span>
          </button>
        </div>
        <div className="slds-panel__body">{children}</div>
      </div>
    </div>
  );
};

export default Panel;
