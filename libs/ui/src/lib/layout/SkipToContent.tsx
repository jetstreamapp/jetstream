import { css } from '@emotion/react';

export interface SkipToContentProps {
  /** id of the main content container; the target should have tabIndex={-1} so focus moves reliably */
  targetId?: string;
}

/**
 * WCAG 2.4.1 (Bypass Blocks): first focusable element on the page. Visually hidden until it
 * receives keyboard focus, then shown as a floating link in the top-left corner.
 */
export const SkipToContent = ({ targetId = 'main-content' }: SkipToContentProps) => (
  <a
    href={`#${targetId}`}
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

export default SkipToContent;
