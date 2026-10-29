import type { AccessProfileToolKey } from '@jetstream/types';

type RouteKey =
  | 'HOME'
  | 'DESKTOP_APPLICATION'
  | 'BROWSER_EXTENSION'
  | 'SALESFORCE_ORG_GROUPS'
  | 'QUERY'
  | 'LOAD'
  | 'LOAD_MULTIPLE'
  | 'LOAD_MASS_UPDATE'
  | 'LOAD_CREATE_RECORD'
  | 'DATA_HISTORY'
  | 'AUTOMATION_CONTROL'
  | 'PERMISSION_MANAGER'
  | 'PERMISSION_ANALYSIS'
  | 'DATA_ANALYSIS'
  | 'DEPLOY_METADATA'
  | 'CREATE_FIELDS'
  | 'FORMULA_EVALUATOR'
  | 'RECORD_TYPE_MANAGER'
  | 'ANON_APEX'
  | 'APEX_TESTS'
  | 'DEBUG_LOG_VIEWER'
  | 'OBJECT_EXPORT'
  | 'SALESFORCE_API'
  | 'PLATFORM_EVENT_MONITOR'
  | 'FEEDBACK_SUPPORT'
  | 'PROFILE'
  | 'TEAM_DASHBOARD'
  | 'TEAM_INVITE'
  | 'SETTINGS'
  | 'BILLING';

interface RouteItem {
  ROUTE: string;
  SEARCH_PARAM: string | undefined;
  DOCS?: string;
  TITLE: string;
  DESCRIPTION: string;
  NEW_UNTIL?: number;
  /** Team access profile tool that grants this route, routes without one are always available */
  TOOL?: AccessProfileToolKey;
}

type RouteMap = Record<RouteKey, RouteItem>;

function getRoutePath(path: string): Pick<RouteItem, 'ROUTE' | 'SEARCH_PARAM'> {
  /**
   * In order for browser extension pages to be able to be opened in a new tab
   * we provide placeholder pages for all routes with extension so we can redirect back to app
   */
  if (globalThis.__IS_BROWSER_EXTENSION__) {
    const searchParams = new URLSearchParams(globalThis?.location?.search);
    searchParams.set('url', `${path}.html`);
    return {
      ROUTE: `${path}.html`,
      SEARCH_PARAM: searchParams.toString(),
    };
  }
  return {
    ROUTE: path,
    SEARCH_PARAM: undefined,
  };
}

export const APP_ROUTES: RouteMap = {
  HOME: {
    ...getRoutePath('/home'),
    TITLE: 'Home',
    DESCRIPTION: 'Welcome to Jetstream',
  },
  DESKTOP_APPLICATION: {
    ROUTE: 'https://getjetstream.app/desktop-app/',
    SEARCH_PARAM: undefined,
    DOCS: 'https://docs.getjetstream.app/desktop-app',
    TITLE: 'Desktop Application',
    DESCRIPTION: 'Use Jetstream on any Salesforce page with the desktop application',
    NEW_UNTIL: new Date(2025, 9, 31, 23, 59, 59).getTime(), // October 31, 2025
  },
  BROWSER_EXTENSION: {
    ROUTE: 'https://getjetstream.app/browser-extensions/',
    SEARCH_PARAM: undefined,
    DOCS: 'https://docs.getjetstream.app/browser-extension',
    TITLE: 'Browser Extension',
    DESCRIPTION: 'Use Jetstream on any Salesforce page with the browser extension',
    NEW_UNTIL: new Date(2025, 6, 31, 23, 59, 59).getTime(), // July 31, 2025
  },
  SALESFORCE_ORG_GROUPS: {
    ...getRoutePath('/org-groups'),
    DOCS: 'https://docs.getjetstream.app/org-groups',
    TITLE: 'Salesforce Org Groups',
    DESCRIPTION: 'Group your Salesforce orgs to work in isolation',
  },
  QUERY: {
    TOOL: 'query',
    ...getRoutePath('/query'),
    DOCS: 'https://docs.getjetstream.app/query',
    TITLE: 'Query Records',
    DESCRIPTION: 'Explore your object and fields and work with records',
  },
  LOAD: {
    TOOL: 'load',
    ...getRoutePath('/load'),
    DOCS: 'https://docs.getjetstream.app/load',
    TITLE: 'Load Records',
    DESCRIPTION: 'Load records from a file',
  },
  LOAD_MULTIPLE: {
    TOOL: 'load',
    ...getRoutePath('/load-multiple-objects'),
    DOCS: 'https://docs.getjetstream.app/load/with-related',
    TITLE: 'Load Records to Multiple Objects',
    DESCRIPTION: 'Load related records for one or more objects',
  },
  LOAD_MASS_UPDATE: {
    TOOL: 'update-records',
    ...getRoutePath('/update-records'),
    DOCS: 'https://docs.getjetstream.app/load/update-records',
    TITLE: 'Update Records Without a File',
    DESCRIPTION: 'Update records based on specified criteria',
  },
  LOAD_CREATE_RECORD: {
    TOOL: 'create-record',
    ...getRoutePath('/create-record'),
    DOCS: 'https://docs.getjetstream.app/load/create-record-without-file',
    TITLE: 'Create New Record',
    DESCRIPTION: 'Create new records without a file',
    NEW_UNTIL: new Date(2025, 6, 31, 23, 59, 59).getTime(), // July 31, 2025
  },
  DATA_HISTORY: {
    TOOL: 'data-history',
    ...getRoutePath('/data-history'),
    DOCS: 'https://docs.getjetstream.app/load/data-history',
    TITLE: 'Data History',
    DESCRIPTION: 'View a local history of the data modifications you have made with Jetstream',
    NEW_UNTIL: new Date(2026, 9, 31, 23, 59, 59).getTime(), // October 31, 2026
  },
  AUTOMATION_CONTROL: {
    TOOL: 'automation-control',
    ...getRoutePath('/automation-control'),
    DOCS: 'https://docs.getjetstream.app/automation-control',
    TITLE: 'Automation Control',
    DESCRIPTION: 'Turn on/off Flows, Process Builders, Triggers, Validation Rules, Workflow Rules',
  },
  PERMISSION_MANAGER: {
    TOOL: 'manage-permissions',
    ...getRoutePath('/permissions-manager'),
    DOCS: 'https://docs.getjetstream.app/permissions',
    TITLE: 'Manage Permissions',
    DESCRIPTION: 'View and update object and field permissions',
  },
  PERMISSION_ANALYSIS: {
    TOOL: 'permission-analysis',
    ...getRoutePath('/permission-analysis'),
    DOCS: 'https://docs.getjetstream.app/permission-analysis',
    TITLE: 'Permission Analysis',
    DESCRIPTION: 'Audit profiles and permission sets for over-access and export the findings',
  },
  DATA_ANALYSIS: {
    TOOL: 'data-analysis',
    ...getRoutePath('/data-analysis'),
    DOCS: 'https://docs.getjetstream.app/data-analysis',
    TITLE: 'Data Analysis',
    DESCRIPTION: 'Field Usage and data coverage for selected Objects',
  },
  DEPLOY_METADATA: {
    TOOL: 'deploy-metadata',
    ...getRoutePath('/deploy-metadata'),
    DOCS: 'https://docs.getjetstream.app/deploy-metadata',
    TITLE: 'Deploy and Compare Metadata',
    DESCRIPTION: 'Move metadata between orgs, compare metadata between orgs, import/export metadata',
  },
  CREATE_FIELDS: {
    TOOL: 'create-fields',
    ...getRoutePath('/create-fields'),
    DOCS: 'https://docs.getjetstream.app/deploy-fields',
    TITLE: 'Create Object and Fields',
    DESCRIPTION: 'Create and update fields in bulk',
  },
  FORMULA_EVALUATOR: {
    TOOL: 'formula-evaluator',
    ...getRoutePath('/formula-evaluator'),
    DOCS: 'https://docs.getjetstream.app/deploy/formula-evaluator',
    TITLE: 'Formula Evaluator',
    DESCRIPTION: 'Create and test formulas',
  },
  RECORD_TYPE_MANAGER: {
    TOOL: 'record-type-manager',
    ...getRoutePath('/record-type-manager'),
    DOCS: 'https://docs.getjetstream.app/deploy/record-type-picklist-manager',
    TITLE: 'Record Type Picklist Manager',
    DESCRIPTION: 'View and update record type picklist values',
    NEW_UNTIL: new Date(2025, 6, 31, 23, 59, 59).getTime(), // July 31, 2025
  },
  ANON_APEX: {
    TOOL: 'anonymous-apex',
    ...getRoutePath('/apex'),
    DOCS: 'https://docs.getjetstream.app/developer/anonymous-apex',
    TITLE: 'Anonymous Apex',
    DESCRIPTION: 'Write and execute anonymous Apex',
  },
  APEX_TESTS: {
    TOOL: 'apex-tests',
    ...getRoutePath('/apex-tests'),
    DOCS: 'https://docs.getjetstream.app/developer/apex-tests',
    TITLE: 'Apex Test Runner',
    DESCRIPTION: 'Run Apex tests and view code coverage',
    NEW_UNTIL: new Date(2026, 10, 30, 23, 59, 59).getTime(), // November 30, 2026
  },
  DEBUG_LOG_VIEWER: {
    TOOL: 'debug-logs',
    ...getRoutePath('/debug-logs'),
    DOCS: 'https://docs.getjetstream.app/developer/debug-logs',
    TITLE: 'View Debug Logs',
    DESCRIPTION: 'Subscribe to and view debug logs',
  },
  OBJECT_EXPORT: {
    TOOL: 'object-export',
    ...getRoutePath('/object-export'),
    DOCS: 'https://docs.getjetstream.app/developer/export-object-metadata',
    TITLE: 'Export Object Metadata',
    DESCRIPTION: 'Export object and field metadata',
  },
  SALESFORCE_API: {
    TOOL: 'salesforce-api',
    ...getRoutePath('/salesforce-api'),
    DOCS: 'https://docs.getjetstream.app/developer/salesforce-api',
    TITLE: 'Salesforce API',
    DESCRIPTION: 'Interact with the Salesforce API',
  },
  PLATFORM_EVENT_MONITOR: {
    TOOL: 'platform-events',
    ...getRoutePath('/platform-event-monitor'),
    DOCS: 'https://docs.getjetstream.app/developer/platform-events',
    TITLE: 'Platform Events',
    DESCRIPTION: 'Subscribe to and publish Platform Events',
  },
  FEEDBACK_SUPPORT: {
    ...getRoutePath('/feedback'),
    DOCS: 'https://docs.getjetstream.app/feedback',
    TITLE: 'Feedback and Support',
    DESCRIPTION: 'Report bugs and request features',
  },
  PROFILE: {
    ...getRoutePath('/profile'),
    DOCS: 'https://docs.getjetstream.app/user-profile-and-settings/user-profile',
    TITLE: 'Profile',
    DESCRIPTION: 'Update your user profile',
  },
  TEAM_DASHBOARD: {
    ...getRoutePath('/teams'),
    // DOCS: 'https://docs.getjetstream.app/user-profile-and-settings/billing',
    TITLE: 'Team Dashboard',
    DESCRIPTION: 'Manage your Team and Team Members',
  },
  TEAM_INVITE: {
    ...getRoutePath('/teams/invite'),
    TITLE: 'Accept Team Invitation',
    DESCRIPTION: 'Accept your invitation to join the team',
  },
  SETTINGS: {
    ...getRoutePath('/settings'),
    DOCS: 'https://docs.getjetstream.app/user-profile-and-settings/settings',
    TITLE: 'User Settings',
    DESCRIPTION: 'Update your user settings',
  },
  BILLING: {
    ...getRoutePath('/settings/billing'),
    DOCS: 'https://docs.getjetstream.app/user-profile-and-settings/billing',
    TITLE: 'Billing',
    DESCRIPTION: 'Manage your Jetstream subscription',
  },
} as const;

/**
 * The team access profile tool that grants a pathname. Matching is by whole path segment so that
 * `/load` does not claim `/load-multiple-objects`, and ignores case because React Router matches paths
 * case-insensitively, so `/LOAD` renders the same page as `/load`.
 */
export function getAccessProfileToolForPath(pathname: string): AccessProfileToolKey | undefined {
  const normalizedPathname = pathname.toLowerCase();
  return Object.values(APP_ROUTES).find(({ ROUTE, TOOL }) => {
    if (!TOOL) {
      return false;
    }
    const normalizedRoute = ROUTE.toLowerCase();
    return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
  })?.TOOL;
}

/**
 * Whether a member can open a pathname. Routes that no tool grants are always available. Takes the tool check as a
 * callback so this library stays free of the ability.
 */
export function isPathAllowedByAccessProfile(pathname: string, canAccessTool: (tool: AccessProfileToolKey) => boolean): boolean {
  const tool = getAccessProfileToolForPath(pathname);
  return !tool || canAccessTool(tool);
}
