import { MAIN_CONTENT_ID } from '@jetstream/ui';
import { ReactNode } from 'react';
import { FocusMainContentOnRouteChange } from './FocusMainContentOnRouteChange';

export interface AppMainContentProps {
  /** Override the content container classes for shells whose layout differs from the shared default. */
  className?: string;
  children: ReactNode;
}

/**
 * The app shell's main content container, shared by every shell (web, desktop, browser extension, canvas).
 *
 * Contract:
 * - Must render inside the router provider — it mounts {@link FocusMainContentOnRouteChange}, which relies
 *   on `useLocation` to move focus into this container after route navigation.
 * - The shell must render `<SkipToContent />` (from `@jetstream/ui`) as the first focusable element on the
 *   page; it targets this container via `id={MAIN_CONTENT_ID}`.
 * - Focus moves here only programmatically (skip link, route change) through `focusContainer`, which adds
 *   the `tabindex` for that moment only — a permanent `tabIndex={-1}` would make every click on page text
 *   focus this container, restarting Tab from the top of the page and stopping keyboard scrolling of the
 *   scroll areas inside it. The outline is suppressed because that programmatic focus is a
 *   keyboard/screen-reader landing point, not a visible selection.
 * - Shells with a floating widget (e.g. UserFeedbackWidget) must render it AFTER this component so the
 *   floating button is the LAST tab stop on the page, not the first.
 */
export function AppMainContent({
  className = 'app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small',
  children,
}: AppMainContentProps) {
  return (
    <>
      <FocusMainContentOnRouteChange />
      <main id={MAIN_CONTENT_ID} style={{ outline: 'none' }} className={className} data-testid="content">
        {children}
      </main>
    </>
  );
}
