import { canAccessTool } from '@jetstream/acl';
import { APP_ROUTES, getAccessProfileToolForPath } from '@jetstream/shared/ui-router';
import { isCanvasApp } from '@jetstream/shared/ui-utils';
import { EmptyState, NoAccess2Illustration } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Link, Outlet, useLocation } from 'react-router';

/**
 * Layout route that keeps members out of tools their team access profile does not include, so a bookmark
 * or deep link shows an explanation instead of the tool. Routes without a tool always render.
 */
export function ToolAccessGuard() {
  const location = useLocation();
  const ability = useAtomValue(abilityState);
  const tool = getAccessProfileToolForPath(location.pathname);

  if (tool && !canAccessTool(ability, tool)) {
    return <ToolNotAvailable />;
  }

  return <Outlet />;
}

export function ToolNotAvailable() {
  return (
    <div className="slds-p-around_large">
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
