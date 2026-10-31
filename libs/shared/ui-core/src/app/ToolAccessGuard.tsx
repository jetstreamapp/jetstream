import { canAccessTool } from '@jetstream/acl';
import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES, isPathAllowedByAccessProfile } from '@jetstream/shared/ui-router';
import { isCanvasApp, useTitle } from '@jetstream/shared/ui-utils';
import { EmptyState, focusContainer, MAIN_CONTENT_ID, NoAccess2Illustration } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

/**
 * Layout route that keeps members out of tools their team access profile does not include, so a bookmark
 * or deep link shows an explanation instead of the tool. Routes without a tool always render.
 */
export function ToolAccessGuard() {
  const { pathname } = useLocation();
  const ability = useAtomValue(abilityState);
  const isAllowed = isPathAllowedByAccessProfile(pathname, (tool) => canAccessTool(ability, tool));
  const previousRef = useRef({ pathname, isAllowed });

  // When an access profile change arrives (heartbeat) while the tool is open, the page swaps without a navigation,
  // so FocusMainContentOnRouteChange does not run and focus inside the removed tool falls to <body>.
  // Only that swap moves focus: on a cold load to a blocked tool the skip link must stay the first tab stop.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { pathname, isAllowed };
    if (!previous.isAllowed || isAllowed || previous.pathname !== pathname) {
      return;
    }
    const container = document.getElementById(MAIN_CONTENT_ID);
    if (container && (!document.activeElement || document.activeElement === document.body)) {
      focusContainer(container);
    }
  }, [pathname, isAllowed]);

  if (!isAllowed) {
    return <ToolNotAvailable />;
  }

  return <Outlet />;
}

export function ToolNotAvailable() {
  useTitle(`Tool Not Available ${TITLES.BAR_JETSTREAM}`);
  return (
    <div className="slds-p-around_large">
      {/* The page has no visible title — give screen reader users a heading to land on and outline from */}
      <h1 className="slds-assistive-text">Tool Not Available</h1>
      <EmptyState
        size="large"
        headline="This tool is not available to you"
        subHeading={
          // Canvas users have no Jetstream team, Salesforce custom permissions choose their tools
          isCanvasApp()
            ? 'Your Salesforce administrator chooses which Jetstream tools you can use.'
            : 'Your team administrator chooses which Jetstream tools you can use with your access profile.'
        }
        illustration={<NoAccess2Illustration />}
      >
        <Link to={APP_ROUTES.HOME.ROUTE} className="slds-button slds-button_brand">
          Go to Home
        </Link>
      </EmptyState>
    </div>
  );
}
