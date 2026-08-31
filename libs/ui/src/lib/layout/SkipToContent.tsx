import { css } from '@emotion/react';
import { MouseEvent } from 'react';
import { focusContainer } from '../utils/focus-container';

/**
 * The app shell's main content container — the element SkipToContent targets by default and the
 * element focused after route navigation. Single source of truth for the `#main-content` contract.
 */
export const MAIN_CONTENT_ID = 'main-content';

export interface SkipToContentProps {
  /** id of the main content container; it does not need a tabIndex, focus is moved with `focusContainer` */
  targetId?: string;
  /** Lets a shell reposition the link, e.g. clear of the desktop app's window controls */
  className?: string;
}

/**
 * WCAG 2.4.1 (Bypass Blocks): first focusable element on the page. Visually hidden until it
 * receives keyboard focus, then shown as a floating link in the top-left corner.
 *
 * Focus is moved programmatically instead of relying on fragment navigation: the app's
 * `<base href="/app">` makes a bare `#fragment` href resolve against the base URL, so following
 * the link would full-page-navigate to the home page instead of jumping within the current page.
 */
export const SkipToContent = ({ targetId = MAIN_CONTENT_ID, className }: SkipToContentProps) => {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      focusContainer(target);
      target.scrollIntoView?.({ block: 'start' });
    }
  }

  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={handleClick}
      css={css`
        position: fixed;
        top: -100px;
        left: 8px;
        z-index: 10000;
        padding: 0.5rem 1rem;
        background-color: var(--slds-g-color-neutral-base-100, #fff);
        color: var(--slds-g-color-brand-base-30, #014486);
        border: 1px solid var(--slds-g-color-border-base-4, #c9c9c9);
        border-radius: 0.25rem;
        &:focus {
          top: 8px;
        }
      `}
    >
      Skip to main content
    </a>
  );
};

export default SkipToContent;
