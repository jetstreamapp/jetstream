import { APP_ROUTES } from '@jetstream/shared/ui-router';
import type { NavbarItemConfig } from '@jetstream/ui';

export const headerNavbarBillingUserItems: NavbarItemConfig[] = [
  {
    id: 'home',
    type: 'waffle',
    path: APP_ROUTES.HOME.ROUTE,
    search: APP_ROUTES.HOME.SEARCH_PARAM,
    title: 'Home',
    assistiveText: 'Home Page',
  },
  {
    id: 'profile',
    type: 'item',
    path: APP_ROUTES.PROFILE.ROUTE,
    search: APP_ROUTES.PROFILE.SEARCH_PARAM,
    title: APP_ROUTES.PROFILE.DESCRIPTION,
    label: APP_ROUTES.PROFILE.TITLE,
  },
  {
    id: 'billing',
    type: 'item',
    path: APP_ROUTES.BILLING.ROUTE,
    search: APP_ROUTES.BILLING.SEARCH_PARAM,
    title: APP_ROUTES.BILLING.DESCRIPTION,
    label: APP_ROUTES.BILLING.TITLE,
  },
  {
    id: 'team-dashboard',
    type: 'item',
    path: APP_ROUTES.TEAM_DASHBOARD.ROUTE,
    search: APP_ROUTES.TEAM_DASHBOARD.SEARCH_PARAM,
    title: APP_ROUTES.TEAM_DASHBOARD.DESCRIPTION,
    label: APP_ROUTES.TEAM_DASHBOARD.TITLE,
  },
];
