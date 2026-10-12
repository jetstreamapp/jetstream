import type { AppAbility } from '@jetstream/acl';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import type { NavbarItemConfig } from '@jetstream/ui';

/** Navbar for the billing role and for members whose team access profile excludes the web application */
export function getReadOnlyUserNavbarItems(ability: AppAbility): NavbarItemConfig[] {
  const items: NavbarItemConfig[] = [
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
  ];

  if (ability.can('read', 'Settings')) {
    items.push({
      id: 'settings',
      type: 'item',
      path: APP_ROUTES.SETTINGS.ROUTE,
      search: APP_ROUTES.SETTINGS.SEARCH_PARAM,
      title: APP_ROUTES.SETTINGS.DESCRIPTION,
      label: APP_ROUTES.SETTINGS.TITLE,
    });
  }
  if (ability.can('read', 'Billing')) {
    items.push({
      id: 'billing',
      type: 'item',
      path: APP_ROUTES.BILLING.ROUTE,
      search: APP_ROUTES.BILLING.SEARCH_PARAM,
      title: APP_ROUTES.BILLING.DESCRIPTION,
      label: APP_ROUTES.BILLING.TITLE,
    });
  }
  if (ability.can('read', 'Team')) {
    items.push({
      id: 'team-dashboard',
      type: 'item',
      path: APP_ROUTES.TEAM_DASHBOARD.ROUTE,
      search: APP_ROUTES.TEAM_DASHBOARD.SEARCH_PARAM,
      title: APP_ROUTES.TEAM_DASHBOARD.DESCRIPTION,
      label: APP_ROUTES.TEAM_DASHBOARD.TITLE,
    });
  }

  return items;
}
