type RouteKey =
  | 'HOME'
  | 'QUERY'
  | 'LOAD'
  | 'LOAD_MULTIPLE'
  | 'LOAD_MASS_UPDATE'
  | 'AUTOMATION_CONTROL'
  | 'PERMISSION_MANAGER'
  | 'DEPLOY_METADATA'
  | 'CREATE_FIELDS'
  | 'FORMULA_EVALUATOR'
  | 'ANON_APEX'
  | 'DEBUG_LOG_VIEWER'
  | 'OBJECT_EXPORT'
  | 'SALESFORCE_API'
  | 'PLATFORM_EVENT_MONITOR'
  | 'FEEDBACK_SUPPORT'
  | 'SETTINGS';

interface RouteItem {
  ROUTE: string;
  DOCS?: string;
  TITLE: string;
  DESCRIPTION: string;
  NEW_UNTIL?: number;
}

type RouteMap = Record<RouteKey, RouteItem>;

export const APP_ROUTES: RouteMap = {
  HOME: {
    ROUTE: '/home',
    TITLE: 'Home',
    DESCRIPTION: 'Welcome to Jetstream',
  },
  QUERY: {
    ROUTE: '/query',
    DOCS: 'https://docs.getjetstream.app/query',
    TITLE: 'Query Records',
    DESCRIPTION: 'Explore your object and fields and work with records',
  },
  LOAD: {
    ROUTE: '/load',
    DOCS: 'https://docs.getjetstream.app/load',
    TITLE: 'Load Records',
    DESCRIPTION: 'Load records from a file',
  },
  LOAD_MULTIPLE: {
    ROUTE: '/load-multiple-objects',
    DOCS: 'https://docs.getjetstream.app/load/with-related',
    TITLE: 'Load Records to Multiple Objects',
    DESCRIPTION: 'Load related records for one or more objects',
  },
  LOAD_MASS_UPDATE: {
    ROUTE: '/update-records',
    DOCS: 'https://docs.getjetstream.app/load/update-records',
    TITLE: 'Update Records Without a File',
    DESCRIPTION: 'Update records based on specified criteria',
  },
  AUTOMATION_CONTROL: {
    ROUTE: '/automation-control',
    DOCS: 'https://docs.getjetstream.app/automation-control',
    TITLE: 'Automation Control',
    DESCRIPTION: 'Turn on/off Flows, Process Builders, Triggers, Validation Rules, Workflow Rules',
  },
  PERMISSION_MANAGER: {
    ROUTE: '/permissions-manager',
    DOCS: 'https://docs.getjetstream.app/permissions',
    TITLE: 'Manage Permissions',
    DESCRIPTION: 'View and update object and field permissions',
  },
  DEPLOY_METADATA: {
    ROUTE: '/deploy-metadata',
    DOCS: 'https://docs.getjetstream.app/deploy-metadata',
    TITLE: 'Deploy and Compare Metadata',
    DESCRIPTION: 'Move metadata between orgs, compare metadata between orgs, import/export metadata',
  },
  CREATE_FIELDS: {
    ROUTE: '/create-fields',
    DOCS: 'https://docs.getjetstream.app/deploy-fields',
    TITLE: 'Create Object and Fields',
    DESCRIPTION: 'Create and update fields in bulk',
  },
  FORMULA_EVALUATOR: {
    ROUTE: '/formula-evaluator',
    DOCS: 'https://docs.getjetstream.app/deploy/formula-evaluator',
    TITLE: 'Formula Evaluator',
    DESCRIPTION: 'Create and test formulas',
    NEW_UNTIL: new Date(2023, 3, 15, 23, 59, 59).getTime(), // April 15, 2023
  },
  ANON_APEX: {
    ROUTE: '/apex',
    DOCS: 'https://docs.getjetstream.app/developer/anonymous-apex',
    TITLE: 'Anonymous Apex',
    DESCRIPTION: 'Write and execute anonymous Apex',
  },
  DEBUG_LOG_VIEWER: {
    ROUTE: '/debug-logs',
    DOCS: 'https://docs.getjetstream.app/developer/debug-logs',
    TITLE: 'View Debug Logs',
    DESCRIPTION: 'Subscribe to and view debug logs',
  },
  OBJECT_EXPORT: {
    ROUTE: '/object-export',
    DOCS: 'https://docs.getjetstream.app/developer/export-object-metadata',
    TITLE: 'Export Object Metadata',
    DESCRIPTION: 'Export object and field metadata',
  },
  SALESFORCE_API: {
    ROUTE: '/salesforce-api',
    DOCS: 'https://docs.getjetstream.app/developer/salesforce-api',
    TITLE: 'Salesforce API',
    DESCRIPTION: 'Interact with the Salesforce API',
  },
  PLATFORM_EVENT_MONITOR: {
    ROUTE: '/platform-event-monitor',
    DOCS: 'https://docs.getjetstream.app/developer/platform-events',
    TITLE: 'Platform Events',
    DESCRIPTION: 'Subscribe to and publish Platform Events',
  },
  FEEDBACK_SUPPORT: {
    ROUTE: '/feedback',
    TITLE: 'Feedback and Support',
    DESCRIPTION: 'Report bugs and request features',
  },
  SETTINGS: {
    ROUTE: '/settings',
    TITLE: 'User Settings',
    DESCRIPTION: 'Update your user settings',
  },
} as const;
