/**
 * Add-on features Salesforce documents for scratch orgs.
 * https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-scratch-orgs-def-file-config-values.html
 *
 * Salesforce adds features every release and does not offer this list through an API, so this is only
 * what is suggested: any other feature can still be typed in and is sent to the Dev Hub as is.
 */
const SCRATCH_ORG_FEATURES_WITHOUT_VALUE = [
  'AccountInspection',
  'AccountPlans',
  'AccountingSubledgerGrowthEdition',
  'AccountingSubledgerStarterEdition',
  'AccountingSubledgerUser',
  'AdmissionsConnectUser',
  'AdvisorLinkFeature',
  'AdvisorLinkPathwaysFeature',
  'AgentforceVibesIDEForDE',
  'AgentforceVibesUnmeteredAccess',
  'AIAttribution',
  'AllUserIdServiceAccess',
  'AnalyticsAdminPerms',
  'AnalyticsAppEmbedded',
  'ApexGuruCodeAnalyzer',
  'ApexIntegrationTests',
  'API',
  'ArcGraphCommunity',
  'Assessments',
  'AssociationEngine',
  'AuthorApex',
  'B2BCommerce',
  'B2BLoyaltyManagement',
  'B2CCommerceGMV',
  'B2CLoyaltyManagement',
  'B2CLoyaltyManagementPlus',
  'BatchManagement',
  'BenefitManagement',
  'BigObjectsBulkAPI',
  'BillingAdvanced',
  'Briefcase',
  'BudgetManagement',
  'BusinessRulesEngine',
  'BYOCCaaS',
  'BYOOTT',
  'CacheOnlyKeys',
  'CampaignInfluence2',
  'CascadeDelete',
  'CaseClassification',
  'CaseWrapUp',
  'CGAnalytics',
  'ChangeDataCapture',
  'Chatbot',
  'ChatterEmailFooterLogo',
  'ChatterEmailFooterText',
  'ChatterEmailSenderName',
  'CleanEnergyProgramManagement',
  'CloneApplication',
  'CMSMaxContType',
  'CMSMaxNodesPerContType',
  'CMSUnlimitedUse',
  'Communities',
  'CompareReportsOrgPerm',
  'ConAppPluginExecuteAsUser',
  'ConnectedAppCustomNotifSubscription',
  'ConnectedAppToolingAPI',
  'ConsentEventStream',
  'ContactsToMultipleAccounts',
  'ContractApprovals',
  'ContractManagement',
  'ContractMgmtInd',
  'CoreCpq',
  'CPQ',
  'CustomerDataPlatform',
  'CustomerDataPlatformLite',
  'CustomerExperienceAnalytics',
  'CustomFieldDataTranslation',
  'CustomNotificationType',
  'DataComDnbAccounts',
  'DataComFullClean',
  'DataMaskUser',
  'DataProcessingEngine',
  'DebugApex',
  'DecisionTable',
  'DefaultWorkflowUser',
  'DeferSharingCalc',
  'DevelopmentWave',
  'DeviceTrackingEnabled',
  'DevOpsCenter',
  'DisableManageIdConfAPI',
  'DisclosureFramework',
  'Division',
  'DocGen',
  'DocGenDesigner',
  'DocGenInd',
  'DocumentChecklist',
  'DocumentReaderPageLimit',
  'DSARPortability',
  'DurableClassicStreamingAPI',
  'DurableGenericStreamingAPI',
  'DynamicClientCreationLimit',
  'EAndUAgentforce',
  'EAndUCoreSales',
  'EAndUCoreSelfServicePortal',
  'EAndUCoreService',
  'EAndUCoreTimeSheetService',
  'EAndUDataKits',
  'EAndUDigitalSales',
  'EAndUSelfServicePortal',
  'EAOutputConnectors',
  'EASyncOut',
  'EdPredictionM3Threshold',
  'EdPredictionTimeout',
  'EdPredictionTimeoutBulk',
  'EdPredictionTimeoutByomBulk',
  'Einstein1AIPlatform',
  'EinsteinAnalyticsPlus',
  'EinsteinArticleRecommendations',
  'EinsteinDocReader',
  'EinsteinRecommendationBuilder',
  'EinsteinSalesRepFdbk',
  'EinsteinSearch',
  'EinsteinVisits',
  'EinsteinVisitsED',
  'EmbeddedLoginForIE',
  'EmergencyManagement',
  'EnableManageIdConfUI',
  'Enablement',
  'EnablePRM',
  'EnableSetPasswordInApi',
  'EnergyAndUtilitiesCloud',
  'Entitlements',
  'EntityTranslation',
  'ERMAnalytics',
  'EventLogFile',
  'ExcludeSAMLSessionIndex',
  'Explainability',
  'ExpressionSetMaxExecPerHour',
  'ExternalIdentityLogin',
  'FieldAuditTrail',
  'FieldServiceMobileExtension',
  'FinanceLogging',
  'FinancialServicesInsuranceUser',
  'FlowSites',
  'ForceComPlatform',
  'ForecastEnableCustomField',
  'FSCAlertFramework',
  'FSCServiceProcess',
  'Fundraising',
  'GenericStreaming',
  'Grantmaking',
  'GuidanceHubAllowed',
  'HealthCloudAddOn',
  'HealthCloudEOLOverride',
  'HealthCloudForCmty',
  'HealthCloudMedicationReconciliation',
  'HealthCloudPNMAddOn',
  'HealthCloudUser',
  'HighVelocitySales',
  'HighVolumePlatformEventAddOn',
  'HLSAnalytics',
  'IdentityProvisioningFeatures',
  'IgnoreQueryParamWhitelist',
  'IndustriesActionPlan',
  'IndustriesBranchManagement',
  'IndustriesCompliantDataSharing',
  'IndustriesManufacturingCmty',
  'IndustriesMfgAccountForecast',
  'IndustriesMfgAdvncdAccFrcs',
  'IndustriesMfgPartnerVisitMgmt',
  'IndustriesMfgProgram',
  'IndustriesMfgRebates',
  'IndustriesMfgTargets',
  'InsightsPlatform',
  'InsuranceCalculationUser',
  'InsuranceClaimMgmt',
  'InsurancePolicyAdmin',
  'IntelligentDocumentReader',
  'Interaction',
  'InvestigativeCaseManagement',
  'InvocableActionExt',
  'InvoiceManagement',
  'IoT',
  'JigsawUser',
  'Knowledge',
  'LegacyLiveAgentRouting',
  'LifeSciencesCloudForCustomerEngagement',
  'LightningSalesConsole',
  'LightningScheduler',
  'LightningServiceConsole',
  'LiveAgent',
  'LiveMessage',
  'LongLayoutSectionTitles',
  'LoyaltyAnalytics',
  'LoyaltyEngine',
  'LoyaltyManagementStarter',
  'Macros',
  'MarketingCloud',
  'MarketingUser',
  'MaterialityAssessment',
  'MaxAudTypeCriterionPerAud',
  'MaxWishlistsItemsPerWishlist',
  'MaxWishlistsPerStoreAccUsr',
  'MinKeyRotationInterval',
  'MobileSecurity',
  'MobileVoiceAndLLM',
  'MultiLevelMasterDetail',
  'MutualAuthentication',
  'MyTrailhead',
  'NonprofitCloudCaseManagementUser',
  'ObjectLinking',
  'OmnistudioDesigner',
  'OmnistudioMetadata',
  'OmnistudioRuntime',
  'OrderManagement',
  'OrderSaveBehaviorBoth',
  'OrderSaveLogicEnabled',
  'OutboundMessageHTTPSession',
  'OutcomeManagement',
  'PardotScFeaturesCampaignInfluence',
  'PersonAccounts',
  'PipelineInspection',
  'PlatformCache',
  'PlatformEncryption',
  'ProcessBuilder',
  'ProductCatalogManagementAddOn',
  'ProductCatalogManagementPCAddOn',
  'ProductCatalogManagementViewerAddOn',
  'ProductsAndSchedules',
  'ProgramManagement',
  'ProviderFreePlatformCache',
  'ProviderManagement',
  'PSSAssetManagement',
  'PublicSectorAccess',
  'PublicSectorApplicationUsageCreditsAddOn',
  'PublicSectorSiteTemplate',
  'RateManagement',
  'RealTimeOfferMgmtForMktUserAddOn',
  'RecordTypes',
  'RefreshOnInvalidSession',
  'RevSubscriptionManagement',
  'S1ClientComponentCacheSize',
  'SalesCloudEinstein',
  'SalesforceContentUser',
  'SalesforceFeedbackManagementStarter',
  'SalesforceHostedMCP',
  'SalesforceIdentityForCommunities',
  'SalesforcePricing',
  'SalesUser',
  'SAML20SingleLogout',
  'SCIMProtocol',
  'ScvMultipartyAndConsult',
  'SecurityEventEnabled',
  'SentimentInsightsFeature',
  'ServiceCatalog',
  'ServiceCloud',
  'ServiceUser',
  'SessionIdInLogEnabled',
  'SFDOInsightsDataIntegrityUser',
  'SharedActivities',
  'Sites',
  'SocialCustomerService',
  'StateAndCountryPicklist',
  'StreamingAPI',
  'SurveyAdvancedFeatures',
  'SustainabilityApp',
  'SustainabilityCloud',
  'TalentRecruitmentManagement',
  'TCRMforSustainability',
  'TimelineConditionsLimit',
  'TimelineEventLimit',
  'TimelineRecordTypeLimit',
  'TimeSheetTemplateSettings',
  'TransactionFinalizers',
  'UsageManagement',
  'VolunteerManagement',
  'WaveMaxCurrency',
  'WavePlatform',
  'Workflow',
  'WorkflowFlowActionFeature',
  'WorkplaceCommandCenterUser',
  'WorkThanksPref',
];

/**
 * Features that are written as `Feature:VALUE`, with the quantities Salesforce documents for the value.
 * The range is only shown as a hint, the Dev Hub is what validates it.
 */
const SCRATCH_ORG_FEATURES_WITH_VALUE: Record<string, string> = {
  AddCustomApps: '1–30',
  AddCustomObjects: '1–30',
  AddCustomRelationships: '1–10',
  AddCustomTabs: '1–30',
  AddDataComCRMRecordCredit: '1–30',
  AddInsightsQueryLimit: '1–30',
  AdditionalFieldHistory: '1–40',
  AssetScheduling: '1–10',
  CalloutSizeMB: '3–12',
  ConcStreamingClients: '20–4,000',
  ConsolePersistenceInterval: '0–500',
  EducationCloud: 'up to 10',
  EmpPublishRateLimit: '1,000–10,000',
  EncryptionStatisticsInterval: '0–604,800',
  EncryptionSyncInterval: '0–604,800',
  FieldService: '1–25',
  FieldServiceAppointmentAssistantUser: '1–25',
  FieldServiceDispatcherUser: '1–25',
  FieldServiceLastMileUser: '1–25',
  FieldServiceMobileUser: '1–25',
  FieldServiceSchedulingUser: '1–25',
  FinancialServicesCommunityUser: '1–10',
  FinancialServicesUser: '1–10',
  GenStreamingEventsPerDay: '10,000–50,000',
  HoursBetweenCoverageJob: '1–24',
  LoyaltyMaximumPartners: '0–1',
  LoyaltyMaximumPrograms: '0–1',
  LoyaltyMaxOrderLinePerHour: '1–3,500,000',
  LoyaltyMaxProcExecPerHour: '1–500,000',
  LoyaltyMaxTransactions: '1–50,000,000',
  LoyaltyMaxTrxnJournals: '1–25,000,000',
  MaxActiveDPEDefs: '1–50',
  MaxApexCodeSize: 'MB, default 10',
  MaxCustomLabels: '1–15',
  MaxDatasetLinksPerDT: '1–3',
  MaxDataSourcesPerDPE: '1–50',
  MaxDecisionTableAllowed: '1–30',
  MaxFavoritesAllowed: '0–200',
  MaxFieldsPerNode: '1–500',
  MaxInputColumnsPerDT: '1–10',
  MaxLoyaltyProcessRules: '1–20',
  MaxNodesPerDPE: '1–500',
  MaxNoOfLexThemesAllowed: '0–300',
  MaxOutputColumnsPerDT: '1–5',
  MaxSourceObjectPerDSL: '1–5',
  MaxStreamingTopics: '40–100',
  MaxUserNavItemsAllowed: '0–500',
  MaxUserStreamingChannels: '20–1,000',
  MaxWritebacksPerDPE: '1–50',
  MedVisDescriptorLimit: '150–1,600',
  MobileExtMaxFileSizeMB: '1–2,000',
  NumPlatformEvents: '5–20',
  PlatformConnect: '1–5',
  PlatformEventsPerDay: '10,000–50,000',
  ServiceCloudVoicePartnerTelephony: '1–50',
  StreamingEventsPerDay: '10,000–50,000',
  SubPerStreamingChannel: '20–4,000',
  SubPerStreamingTopic: '20–4,000',
};

export interface KnownScratchOrgFeature {
  name: string;
  /** Written as `Feature:VALUE`, the feature is rejected without a value */
  requiresValue: boolean;
  valueHint?: string;
}

/** A feature split into its name and the optional value after the colon */
export interface ScratchOrgFeatureEntry {
  name: string;
  /** null when the feature has no `:value` part, an empty string when the value still has to be entered */
  value: string | null;
}

/** Documented features in alphabetical order */
export const KNOWN_SCRATCH_ORG_FEATURES: KnownScratchOrgFeature[] = [
  ...SCRATCH_ORG_FEATURES_WITHOUT_VALUE.map((name) => ({ name, requiresValue: false })),
  ...Object.entries(SCRATCH_ORG_FEATURES_WITH_VALUE).map(([name, valueHint]) => ({ name, requiresValue: true, valueHint })),
].sort((featureA, featureB) => compareFeatureNames(featureA.name, featureB.name));

const KNOWN_FEATURES_BY_KEY = new Map(KNOWN_SCRATCH_ORG_FEATURES.map((feature) => [getScratchOrgFeatureKey(feature.name), feature]));

export function compareFeatureNames(nameA: string, nameB: string): number {
  return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
}

/** Salesforce treats feature names as case-insensitive, so this is what identifies a feature */
export function getScratchOrgFeatureKey(name: string): string {
  return name.trim().toLowerCase();
}

export function getKnownScratchOrgFeature(name: string): KnownScratchOrgFeature | undefined {
  return KNOWN_FEATURES_BY_KEY.get(getScratchOrgFeatureKey(name));
}

/** `MaxApexCodeSize:10` -> name and value. A documented feature gets the spelling Salesforce uses. */
export function parseScratchOrgFeature(feature: string): ScratchOrgFeatureEntry {
  const separatorIndex = feature.indexOf(':');
  const name = (separatorIndex < 0 ? feature : feature.slice(0, separatorIndex)).trim();
  const value = separatorIndex < 0 ? null : feature.slice(separatorIndex + 1).trim();
  return { name: getKnownScratchOrgFeature(name)?.name ?? name, value };
}

export function formatScratchOrgFeature({ name, value }: ScratchOrgFeatureEntry): string {
  return value === null ? name : `${name}:${value}`;
}

/**
 * Features as they are sent to Salesforce. A value that was left blank is dropped unless the feature requires one,
 * which {@link getScratchOrgFeatureProblems} reports.
 */
export function normalizeScratchOrgFeatures(features: string[]): string[] {
  return features.map(parseScratchOrgFeature).map((entry) => {
    const hasBlankOptionalValue = entry.value === '' && !getKnownScratchOrgFeature(entry.name)?.requiresValue;
    return formatScratchOrgFeature(hasBlankOptionalValue ? { ...entry, value: null } : entry);
  });
}

/**
 * Problems that are certain to make Salesforce reject the request.
 * Unknown features and the range of a value are left to the Dev Hub, which knows what it supports.
 * @returns a description of each problem, empty when there are none
 */
export function getScratchOrgFeatureProblems(features: string[]): string[] {
  return features.map(parseScratchOrgFeature).flatMap(({ name, value }) => {
    if (!name) {
      return ['A feature is missing its name'];
    }
    if (!getKnownScratchOrgFeature(name)?.requiresValue) {
      return [];
    }
    if (!value) {
      return [`${name} requires a value`];
    }
    return /^\d+$/.test(value) ? [] : [`The value of ${name} must be a whole number`];
  });
}
