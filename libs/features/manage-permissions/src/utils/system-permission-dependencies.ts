/**
 * System permission dependencies, transcribed from the Salesforce Setup UI "Requires these permissions"
 * tooltips (Setup → Permission Sets → System Permissions). Salesforce does not expose these dependencies
 * through the describe or metadata API, so they are maintained here. Keys and values are `Permissions*`
 * field API names on the PermissionSet object.
 *
 * When a permission is enabled we also enable everything it requires; when a permission is disabled we
 * also disable everything that requires it (mirroring Salesforce's checkbox behavior).
 */

/** Direct requirements: enabling the key permission requires each listed permission to also be enabled. */
export const SYSTEM_PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  PermissionsAuthorApex: ['PermissionsViewSetup', 'PermissionsModifyMetadata'],
  PermissionsAuthorizePayments: ['PermissionsViewPayments'],
  PermissionsBotManageBots: ['PermissionsViewSetup'],
  PermissionsBotManageBotsTrainingData: ['PermissionsViewSetup'],
  PermissionsCanEditPrompts: ['PermissionsViewSetup'],
  PermissionsCaptureAndReversePayments: ['PermissionsViewPayments'],
  PermissionsCombAuthAndCapPayments: ['PermissionsViewPayments'],
  PermissionsCreateCustomizeReports: ['PermissionsRunReports'],
  PermissionsCreateDashboardFolders: ['PermissionsCreateCustomizeDashboards'],
  PermissionsCreatePackaging: [
    'PermissionsEditHtmlTemplates',
    'PermissionsViewAllData',
    'PermissionsCustomizeApplication',
    'PermissionsManageUsers',
    'PermissionsEditBrandTemplates',
  ],
  PermissionsCreateReportFolders: ['PermissionsCreateCustomizeReports'],
  PermissionsCreateReportInLightning: ['PermissionsCreateCustomizeReports'],
  PermissionsCustomizeApplication: ['PermissionsViewSetup', 'PermissionsManageCustomPermissions'],
  PermissionsEditBillingInfo: ['PermissionsViewSetup'],
  PermissionsEditBrandTemplates: ['PermissionsViewSetup'],
  PermissionsEditMyDashboards: ['PermissionsCreateCustomizeDashboards'],
  PermissionsEditMyReports: ['PermissionsCreateCustomizeReports'],
  PermissionsEditPublicFilters: ['PermissionsCreateCustomizeFilters'],
  PermissionsEditPublicTemplates: ['PermissionsViewSetup'],
  PermissionsEmailMass: ['PermissionsEmailSingle'],
  PermissionsEmailSingle: ['PermissionsEditTask'],
  PermissionsExportReport: ['PermissionsRunReports'],
  PermissionsExternalClientAppAdmin: ['PermissionsExternalClientAppViewer'],
  PermissionsExternalClientAppDeveloper: ['PermissionsExternalClientAppAdmin'],
  PermissionsInsightsAppAdmin: ['PermissionsInsightsAppUser'],
  PermissionsInsightsAppDashboardEditor: ['PermissionsInsightsAppUser'],
  PermissionsInsightsCreateApplication: ['PermissionsInsightsAppUser'],
  PermissionsInstallPackaging: [
    'PermissionsEditHtmlTemplates',
    'PermissionsModifyAllData',
    'PermissionsCustomizeApplication',
    'PermissionsManageUsers',
    'PermissionsEditBrandTemplates',
  ],
  PermissionsListEmailSend: ['PermissionsEmailMass'],
  PermissionsManageAccessPolicies: ['PermissionsViewAccessPolicies'],
  PermissionsManageAnalyticSnapshots: ['PermissionsViewSetup', 'PermissionsRunReports'],
  PermissionsManageApiNamedQueries: ['PermissionsViewApiNamedQueries'],
  PermissionsManageAuthProviders: ['PermissionsManageUsers', 'PermissionsAuthorApex'],
  PermissionsManageCustomDomains: ['PermissionsViewSetup'],
  PermissionsManageCustomReportTypes: ['PermissionsViewSetup'],
  PermissionsManageDashbdsInPubFolders: [
    'PermissionsViewPublicDashboards',
    'PermissionsEditMyDashboards',
    'PermissionsCreateDashboardFolders',
  ],
  PermissionsManageDataCategories: ['PermissionsViewDataCategories'],
  PermissionsManageEmailClientConfig: ['PermissionsViewSetup'],
  PermissionsManageExchangeConfig: ['PermissionsViewSetup'],
  PermissionsManageHealthCheck: ['PermissionsViewHealthCheck'],
  PermissionsManageMobile: ['PermissionsViewSetup'],
  PermissionsManageReportsInPubFolders: ['PermissionsViewPublicReports', 'PermissionsCreateReportFolders', 'PermissionsEditMyReports'],
  PermissionsManageSessionPermissionSets: ['PermissionsApiEnabled'],
  PermissionsManageSynonyms: ['PermissionsViewSetup'],
  PermissionsManageTemplatedApp: ['PermissionsUseTemplatedApp'],
  PermissionsManageTwoFactor: ['PermissionsManageUsers'],
  PermissionsManageUsers: [
    'PermissionsResetPasswords',
    'PermissionsViewAllUsers',
    'PermissionsFreezeUsers',
    'PermissionsManageProfilesPermissionsets',
    'PermissionsAssignPermissionSets',
    'PermissionsManageRoles',
    'PermissionsManageIpAddresses',
    'PermissionsManageSharing',
    'PermissionsMonitorLoginHistory',
    'PermissionsViewSetup',
    'PermissionsManageInternalUsers',
    'PermissionsManagePasswordPolicies',
    'PermissionsManageLoginAccessPolicies',
    'PermissionsDelegatedTwoFactor',
  ],
  PermissionsMergeTopics: ['PermissionsDeleteTopics'],
  PermissionsModifyAllData: [
    'PermissionsEditPublicFilters',
    'PermissionsEditPublicTemplates',
    'PermissionsRunReports',
    'PermissionsViewSetup',
    'PermissionsTransferAnyEntity',
    'PermissionsImportLeads',
    'PermissionsTransferAnyLead',
    'PermissionsViewAllData',
    'PermissionsEditPublicDocuments',
    'PermissionsManageCategories',
    'PermissionsConvertLeads',
    'PermissionsUseTeamReassignWizards',
    'PermissionsSolutionImport',
    'PermissionsManageNetworks',
    'PermissionsManageDashbdsInPubFolders',
    'PermissionsManageReportsInPubFolders',
    'PermissionsConnectOrgToEnvironmentHub',
    'PermissionsDeleteTopics',
    'PermissionsEditTopics',
    'PermissionsCreateTopics',
    'PermissionsAssignTopics',
    'PermissionsModifyMetadata',
    'PermissionsEditTask',
    'PermissionsEditEvent',
  ],
  PermissionsModifyAllPolicyCenterPolicies: ['PermissionsViewAllPolicyCenterPolicies'],
  PermissionsModifyMetadata: ['PermissionsViewSetup'],
  PermissionsPreventClassicExperience: ['PermissionsLightningExperienceUser'],
  PermissionsPublishPackaging: ['PermissionsCreatePackaging'],
  PermissionsRefundPayments: ['PermissionsViewPayments'],
  PermissionsRemoveDirectMessageMembers: ['PermissionsAddDirectMessageMembers'],
  PermissionsResetPasswords: ['PermissionsViewSetup'],
  PermissionsSubscribeDashboardRolesGrps: ['PermissionsSubscribeDashboardToOtherUsers'],
  PermissionsSubscribeDashboardToOtherUsers: ['PermissionsSubscribeToLightningDashboards'],
  PermissionsSubscribeReportRolesGrps: ['PermissionsSubscribeReportToOtherUsers'],
  PermissionsSubscribeReportToOtherUsers: ['PermissionsSubscribeToLightningReports'],
  PermissionsSubscribeReportsRunAsUser: ['PermissionsSubscribeToLightningReports'],
  PermissionsSubscribeToLightningDashboards: ['PermissionsRunReports'],
  PermissionsSubscribeToLightningReports: ['PermissionsRunReports'],
  PermissionsTerritoryOperations: ['PermissionsViewSetup'],
  PermissionsTransactionalEmailSend: ['PermissionsEmailSingle'],
  PermissionsTwoFactorApi: ['PermissionsForceTwoFactor'],
  PermissionsUseAssistantDialog: ['PermissionsUseMySearch'],
  PermissionsUseQuerySuggestions: ['PermissionsUseAssistantDialog'],
  PermissionsViewAllData: [
    'PermissionsViewSetup',
    'PermissionsViewEventLogFiles',
    'PermissionsViewPublicDashboards',
    'PermissionsViewPublicReports',
    'PermissionsViewPlatformEvents',
    'PermissionsViewDataLeakageEvents',
  ],
  PermissionsViewDataCategories: ['PermissionsViewSetup'],
  PermissionsViewHealthCheck: ['PermissionsViewSetup'],
};

/**
 * Full, human-readable requirement text shown in the UI tooltip. This intentionally includes
 * requirements that are object-level (or otherwise not settable system permissions) and are therefore
 * NOT auto-toggled — the tooltip stays faithful to what Salesforce shows even when we can't cascade it.
 */
export const SYSTEM_PERMISSION_DEPENDENCY_TOOLTIP: Record<string, string> = {
  PermissionsAuthorApex: 'View Setup and Configuration, Modify Metadata Through Metadata API Functions',
  PermissionsAuthorizePayments: 'Use Payments or Access Payments',
  PermissionsBotManageBots: 'View Setup and Configuration',
  PermissionsBotManageBotsTrainingData: 'View Setup and Configuration',
  PermissionsCanEditPrompts: 'View Setup and Configuration',
  PermissionsCaptureAndReversePayments: 'Use Payments or Access Payments',
  PermissionsCombAuthAndCapPayments: 'Use Payments or Access Payments',
  PermissionsCreateCustomizeReports: 'Run Reports',
  PermissionsCreateDashboardFolders: 'Create and Customize Dashboards',
  PermissionsCreatePackaging: 'Edit HTML Templates, View All Data, Customize Application, Manage Users, Manage Letterheads',
  PermissionsCreateReportFolders: 'Create and Customize Reports',
  PermissionsCreateReportInLightning: 'Create and Customize Reports',
  PermissionsCustomizeApplication: 'View Setup and Configuration, Manage Custom Permissions',
  PermissionsEditBillingInfo: 'View Setup and Configuration',
  PermissionsEditBrandTemplates: 'View Setup and Configuration',
  PermissionsEditHtmlTemplates: 'Read Document',
  PermissionsEditMyDashboards: 'Create and Customize Dashboards',
  PermissionsEditMyReports: 'Create and Customize Reports',
  PermissionsEditPublicDocuments: 'Create Document, Edit Document, Delete Document',
  PermissionsEditPublicFilters: 'Create and Customize List Views',
  PermissionsEditPublicTemplates: 'View Setup and Configuration',
  PermissionsEmailMass: 'Send Email',
  PermissionsEmailSingle: 'Edit Tasks',
  PermissionsExportReport: 'Run Reports',
  PermissionsExternalClientAppAdmin: 'View all External Client Apps',
  PermissionsExternalClientAppDeveloper: 'View all External Client Apps, view their settings, and edit their policies',
  PermissionsInsightsAppAdmin: 'Use CRM Analytics',
  PermissionsInsightsAppDashboardEditor: 'Use CRM Analytics',
  PermissionsInsightsCreateApplication: 'Use CRM Analytics',
  PermissionsInstallPackaging: 'Edit HTML Templates, Modify All Data, Customize Application, Manage Users, Manage Letterheads',
  PermissionsListEmailSend: 'Mass Email',
  PermissionsManageAccessPolicies: 'View Access Policies',
  PermissionsManageAnalyticSnapshots: 'View Setup and Configuration, Run Reports',
  PermissionsManageApiNamedQueries: 'Allows users to view Named Query records',
  PermissionsManageAuthProviders: 'Manage Users, Author Apex',
  PermissionsManageCustomDomains: 'View Setup and Configuration',
  PermissionsManageCustomReportTypes: 'View Setup and Configuration',
  PermissionsManageDashbdsInPubFolders: 'View Dashboards in Public Folders, Edit My Dashboards, Create Dashboard Folders',
  PermissionsManageDataCategories: 'View Data Categories in Setup',
  PermissionsManageEmailClientConfig: 'View Setup and Configuration',
  PermissionsManageExchangeConfig: 'View Setup and Configuration',
  PermissionsManageHealthCheck: 'View Health Check',
  PermissionsManageMobile: 'View Setup and Configuration',
  PermissionsManageReportsInPubFolders: 'View Reports in Public Folders, Create Report Folders, Edit My Reports',
  PermissionsManageSessionPermissionSets: 'API Enabled',
  PermissionsManageSynonyms: 'View Setup and Configuration',
  PermissionsManageTemplatedApp: 'Use CRM Analytics Templated Apps',
  PermissionsManageTwoFactor: 'Manage Users',
  PermissionsManageUsers:
    'Reset User Passwords and Unlock Users, View All Users, Freeze Users, Manage Profiles and Permission Sets, Assign Permission Sets, Manage Roles, Manage IP Addresses, Manage Sharing, Monitor Login History, View Setup and Configuration, Manage Internal Users, Manage Password Policies, Manage Login Access Policies, Manage MFA in User Interface',
  PermissionsMergeTopics: 'Delete Topics',
  PermissionsModifyAllData:
    'Manage Public List Views, Manage Public Classic Email Templates, Run Reports, View Setup and Configuration, Transfer Record, Import Leads, Transfer Leads, View All Data, Manage Public Documents, Manage Categories, Convert Leads, Use Team Reassignment Wizards, Import Solutions, Create and Set Up Experiences, Manage Dashboards in Public Folders, Manage Reports in Public Folders, Connect Organization to Environment Hub, Delete Topics, Edit Topics, Create Topics, Assign Topics, Modify Metadata Through Metadata API Functions, Edit Tasks, Edit Events',
  PermissionsModifyAllPolicyCenterPolicies: 'View All Policy Center Policies',
  PermissionsModifyMetadata: 'View Setup and Configuration',
  PermissionsPreventClassicExperience: 'Lightning Experience User',
  PermissionsPublishPackaging: 'Create AppExchange Packages',
  PermissionsRefundPayments: 'Use Payments or Access Payments',
  PermissionsRemoveDirectMessageMembers: 'Add People to Direct Messages',
  PermissionsResetPasswords: 'View Setup and Configuration',
  PermissionsSubscribeDashboardRolesGrps: 'Subscribe to Dashboards: Add Recipients',
  PermissionsSubscribeDashboardToOtherUsers: 'Subscribe to Dashboards',
  PermissionsSubscribeReportRolesGrps: 'Subscribe to Reports: Add Recipients',
  PermissionsSubscribeReportToOtherUsers: 'Subscribe to Reports',
  PermissionsSubscribeReportsRunAsUser: 'Subscribe to Reports',
  PermissionsSubscribeToLightningDashboards: 'Run Reports',
  PermissionsSubscribeToLightningReports: 'Run Reports',
  PermissionsTerritoryOperations: 'View Setup and Configuration',
  PermissionsTransactionalEmailSend: 'Send Email',
  PermissionsTwoFactorApi: 'Multi-Factor Authentication for User Interface Logins',
  PermissionsUseAssistantDialog: 'Einstein Search',
  PermissionsUseQuerySuggestions: 'Instant Actionable Results',
  PermissionsViewAllData:
    'View Setup and Configuration, View Event Log Files, View Dashboards in Public Folders, View Reports in Public Folders, View Login Forensics Events, View Real-Time Event Monitoring Data',
  PermissionsViewDataCategories: 'View Setup and Configuration',
  PermissionsViewHealthCheck: 'View Setup and Configuration',
};

/**
 * Expand a direct-dependency map into transitive closures. `visit` follows edges depth-first and
 * dedupes, so cycles (which should not exist in the data) terminate rather than recurse forever.
 */
function computeTransitiveClosure(directDependencies: Record<string, string[]>): Record<string, string[]> {
  const closure: Record<string, string[]> = {};

  function visit(node: string, collected: string[], seen: Set<string>) {
    for (const dependency of directDependencies[node] || []) {
      if (!seen.has(dependency)) {
        seen.add(dependency);
        collected.push(dependency);
        visit(dependency, collected, seen);
      }
    }
  }

  for (const node of Object.keys(directDependencies)) {
    const collected: string[] = [];
    visit(node, collected, new Set<string>());
    closure[node] = collected;
  }
  return closure;
}

/**
 * All permissions a given permission (transitively) requires. Enabling a permission should enable
 * every permission in its required-closure.
 */
export const SYSTEM_PERMISSION_REQUIRED_CLOSURE: Record<string, string[]> = computeTransitiveClosure(SYSTEM_PERMISSION_DEPENDENCIES);

/**
 * The inverse: all permissions that (transitively) require a given permission. Disabling a permission
 * should disable every permission in its dependent-closure, since they can't be enabled without it.
 */
export const SYSTEM_PERMISSION_DEPENDENT_CLOSURE: Record<string, string[]> = Object.entries(SYSTEM_PERMISSION_REQUIRED_CLOSURE).reduce(
  (dependents: Record<string, string[]>, [permission, requiredPermissions]) => {
    for (const requiredPermission of requiredPermissions) {
      (dependents[requiredPermission] ||= []).push(permission);
    }
    return dependents;
  },
  {},
);
