import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { NavbarItem, NavbarItemWaffle } from '@jetstream/ui';

export const HeaderNavbarBillingUserItems = () => {
  return (
    <>
      <NavbarItemWaffle path={APP_ROUTES.HOME.ROUTE} search={APP_ROUTES.HOME.SEARCH_PARAM} title="Home" assistiveText="Home Page" />
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
