import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { NavbarItem } from '@jetstream/ui';

export const HeaderNavbarBillingUserItems = () => {
  return (
    <>
      <NavbarItem
        path={APP_ROUTES.HOME.ROUTE}
        search={APP_ROUTES.HOME.SEARCH_PARAM}
        title="Home"
        label={
          <button className="slds-button slds-icon-waffle_container">
            <span className="slds-icon-waffle">
              <span className="slds-r1"></span>
              <span className="slds-r2"></span>
              <span className="slds-r3"></span>
              <span className="slds-r4"></span>
              <span className="slds-r5"></span>
              <span className="slds-r6"></span>
              <span className="slds-r7"></span>
              <span className="slds-r8"></span>
              <span className="slds-r9"></span>
            </span>
            <span className="slds-assistive-text">Home Page</span>
          </button>
        }
      />
      <NavbarItem
        path={APP_ROUTES.PROFILE.ROUTE}
        search={APP_ROUTES.PROFILE.SEARCH_PARAM}
        title={APP_ROUTES.PROFILE.DESCRIPTION}
        label={APP_ROUTES.PROFILE.TITLE}
      />

      <NavbarItem
        path={APP_ROUTES.BILLING.ROUTE}
        search={APP_ROUTES.BILLING.SEARCH_PARAM}
        title={APP_ROUTES.BILLING.DESCRIPTION}
        label={APP_ROUTES.BILLING.TITLE}
      />

      <NavbarItem
        path={APP_ROUTES.TEAM_DASHBOARD.ROUTE}
        search={APP_ROUTES.TEAM_DASHBOARD.SEARCH_PARAM}
        title={APP_ROUTES.TEAM_DASHBOARD.DESCRIPTION}
        label={APP_ROUTES.TEAM_DASHBOARD.TITLE}
      />
    </>
  );
};
