import { logger } from '@jetstream/shared/client-logger';
import {
  deployMetadata as deployMetadataZip,
  genericRequest,
  getCacheItemNonHttp,
  query,
  retrieveMetadataFromListMetadata,
  saveCacheItemNonHttp,
} from '@jetstream/shared/data';
import {
  getOrgType,
  getToolingRecords,
  logErrorToRollbar,
  pollMetadataResultsUntilDone,
  pollRetrieveMetadataResultsUntilDone,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, groupByFlat, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CompositeRequest, CompositeRequestBody, CompositeResponse, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { formatRelative } from 'date-fns/formatRelative';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { Observable, Subject, from, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import {
  getApexTriggersQuery,
  getDuplicateRuleQuery,
  getFlowsQuery,
  getProcessBuildersQuery,
  getValidationRulesQuery,
  getWorkflowRulesQuery,
} from './automation-control-soql-utils';
import {
  AutomationControlDeploymentItem,
  AutomationMetadataType,
  DeploymentItem,
  DeploymentItemMap,
  DuplicateRuleRecord,
  FetchErrorPayload,
  FetchSuccessPayload,
  FlowMetadata,
  FlowViewRecord,
  MetadataCompositeResponseError,
  MetadataCompositeResponseSuccess,
  MetadataCompositeResponseSuccessOrError,
  MetadataWorkflowRuleRecord,
  TableItemAdditionalData,
  TableRow,
  TableRowItem,
  TableRowItemChild,
  TableRowOrItemOrChild,
  ToolingApexTriggerRecord,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from './automation-control-types';

// Example: {[orgId]: {[durableId]: sobject}}
// FIXME: we should persist this in durable cache and let user know the last time refreshed and allow refresh
// const processBuilderCacheByOrgId = new Map<string, Map<string, string>>();
const PROCESS_BUILDER_CACHE_ID = 'automation-control-process-builders';
let processBuilderCachedSince: number;

export function isFetchSuccess(item: any): item is FetchSuccessPayload {
  return !!item.records;
}

export function isTableRow(item: TableRowOrItemOrChild): item is TableRow {
  return item.path.length === 1;
}

export function isTableRowItem(item: TableRowOrItemOrChild): item is TableRowItem {
  return item.path.length === 2;
}

export function isTableRowChild(item: TableRowOrItemOrChild): item is TableRowItemChild {
  return item.path.length === 3;
}

export function isToolingApexRecord(type: AutomationMetadataType, record: any): record is ToolingApexTriggerRecord {
  return type === 'ApexTrigger';
}

export function isDuplicateRecord(type: AutomationMetadataType, record: any): record is DuplicateRuleRecord {
  return type === 'DuplicateRule';
}

export function isValidationRecord(type: AutomationMetadataType, record: any): record is ToolingValidationRuleRecord {
  return type === 'ValidationRule';
}

export function isWorkflowRuleRecord(type: AutomationMetadataType, record: any): record is ToolingWorkflowRuleRecord {
  return type === 'WorkflowRule';
}

export function isFlowRecord(type: AutomationMetadataType, record: any): record is FlowViewRecord {
  return type === 'FlowRecordTriggered' || type === 'FlowProcessBuilder';
}

export function getAutomationTypeLabel(type: AutomationMetadataType) {
  switch (type) {
    case 'ApexTrigger':
      return 'Apex Trigger';
    case 'DuplicateRule':
      return 'Duplicate Rule';
    case 'ValidationRule':
      return 'Validation Rule';
    case 'WorkflowRule':
      return 'Workflow Rule';
    case 'FlowRecordTriggered':
      return 'Flow';
    case 'FlowProcessBuilder':
      return 'Process Builder';
    default:
      return type;
  }
}

export function getAutomationDeployType(type: AutomationMetadataType) {
  switch (type) {
    case 'FlowRecordTriggered':
    case 'FlowProcessBuilder':
      return 'FlowDefinition';
    default:
      return type;
  }
}

export function getProcessBuilderCachedSince(): string | null {
  if (processBuilderCachedSince) {
    return `Last Updated ${formatRelative(new Date(processBuilderCachedSince), new Date())}`;
  }
  return null;
}

/**
 * Fetch specified metadata types as an observable and request all in parallel and emit as results come in
 * @param selectedOrg
 * @param defaultApiVersion
 * @param selectedAutomationTypes
 * @param selectedSObjects
 * @returns
 */
export function fetchAutomationData(
  selectedOrg: SalesforceOrgUi,
  defaultApiVersion: string,
  selectedAutomationTypes: AutomationMetadataType[],
  selectedSObjects: string[]
): Observable<FetchSuccessPayload | FetchErrorPayload> {
  const selectedTypes = new Set(selectedAutomationTypes);
  const requests: Observable<FetchSuccessPayload | FetchErrorPayload>[] = [];

  if (selectedTypes.has('ApexTrigger')) {
    requests.push(
      from(
        getApexTriggersMetadata(selectedOrg, selectedSObjects).then((records) => ({ type: 'ApexTrigger', records } as FetchSuccessPayload))
      ).pipe(
        catchError((error) => of({ type: 'ApexTrigger', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload))
      )
    );
  }
  if (selectedTypes.has('DuplicateRule')) {
    requests.push(
      from(
        getDuplicateRules(selectedOrg, selectedSObjects).then((records) => ({ type: 'DuplicateRule', records } as FetchSuccessPayload))
      ).pipe(
        catchError((error) => of({ type: 'DuplicateRule', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload))
      )
    );
  }
  if (selectedTypes.has('ValidationRule')) {
    requests.push(
      from(
        getValidationRulesMetadata(selectedOrg, defaultApiVersion, selectedSObjects).then(
          (records) => ({ type: 'ValidationRule', records } as FetchSuccessPayload)
        )
      ).pipe(
        catchError((error) =>
          of({ type: 'ValidationRule', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload)
        )
      )
    );
  }
  if (selectedTypes.has('WorkflowRule')) {
    requests.push(
      from(
        getWorkflowRulesMetadata(selectedOrg, defaultApiVersion, selectedSObjects).then(
          (records) => ({ type: 'WorkflowRule', records } as FetchSuccessPayload)
        )
      ).pipe(
        catchError((error) => of({ type: 'WorkflowRule', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload))
      )
    );
  }
  if (selectedTypes.has('FlowRecordTriggered')) {
    requests.push(
      from(
        getFlowsMetadata(selectedOrg, selectedSObjects).then((records) => ({ type: 'FlowRecordTriggered', records } as FetchSuccessPayload))
      ).pipe(
        catchError((error) =>
          of({ type: 'FlowRecordTriggered', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload)
        )
      )
    );
  }
  if (selectedTypes.has('FlowProcessBuilder')) {
    requests.push(
      from(
        getProcessBuildersMetadata(selectedOrg, defaultApiVersion, selectedSObjects).then(
          (records) => ({ type: 'FlowProcessBuilder', records } as FetchSuccessPayload)
        )
      ).pipe(
        catchError((error) =>
          of({ type: 'FlowProcessBuilder', error: error?.message || 'An unknown error has occurred.' } as FetchErrorPayload)
        )
      )
    );
  }

  return from(requests).pipe(mergeMap((item) => item));
}

/** Query ApexTriggers */
export async function getApexTriggersMetadata(selectedOrg: SalesforceOrgUi, sobjects: string[]): Promise<ToolingApexTriggerRecord[]> {
  const apexClassRecords = (
    await Promise.all(
      splitArrayToMaxSize(sobjects, 300).map((currSobjects) =>
        query<ToolingApexTriggerRecord>(selectedOrg, getApexTriggersQuery(currSobjects), true)
      )
    )
  ).flatMap(({ queryResults }) => queryResults.records);
  return apexClassRecords;
}

/** Query DuplicateRules */
export async function getDuplicateRules(selectedOrg: SalesforceOrgUi, sobjects: string[]): Promise<DuplicateRuleRecord[]> {
  const apexClassRecords = (
    await Promise.all(
      splitArrayToMaxSize(sobjects, 300).map((currSobjects) =>
        query<DuplicateRuleRecord>(selectedOrg, getDuplicateRuleQuery(currSobjects), false)
      )
    )
  ).flatMap(({ queryResults }) => queryResults.records);
  return apexClassRecords;
}

/**
 * Query initial records, then query each record and add FullName and Metadata fields
 *
 * @param selectedOrg
 * @param validationRuleRecords
 */
export async function getValidationRulesMetadata(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
  sobjects: string[]
): Promise<ToolingValidationRuleRecord[]> {
  const validationRuleRecords = (
    await Promise.all(
      splitArrayToMaxSize(sobjects, 300).map((currSobjects) =>
        query<ToolingValidationRuleRecord>(selectedOrg, getValidationRulesQuery(currSobjects), true)
      )
    )
  ).flatMap(({ queryResults }) => queryResults.records);

  if (validationRuleRecords.length === 0) {
    return [];
  }

  const validationRules = await getToolingRecords<ToolingValidationRuleRecord>(
    selectedOrg,
    'ValidationRule',
    validationRuleRecords.map((record) => record.Id),
    apiVersion
  );
  const validationRuleMetaById = groupByFlat(
    validationRules.compositeResponse.map((item) => item.body),
    'Id'
  );

  return validationRuleRecords.map((validationRule) => ({
    ...validationRule,
    ...validationRuleMetaById[validationRule.Id],
  }));
}

/**
 * Gets workflow rules with FullName and Metadata fields populated
 *
 * @param selectedOrg
 * @param sobject
 */
export async function getWorkflowRulesMetadata(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
  sobjects: string[]
): Promise<ToolingWorkflowRuleRecord[]> {
  const workflowRuleRecords = (
    await Promise.all(
      splitArrayToMaxSize(sobjects, 300).map((currSobjects) =>
        query<ToolingWorkflowRuleRecord>(selectedOrg, getWorkflowRulesQuery(currSobjects), true)
      )
    )
  ).flatMap(({ queryResults }) => queryResults.records);

  if (workflowRuleRecords.length === 0) {
    return [];
  }

  const workflowRules = await getToolingRecords<ToolingWorkflowRuleRecord>(
    selectedOrg,
    'WorkflowRule',
    workflowRuleRecords.map((record) => record.Id),
    apiVersion
  );

  const workflowRuleMetaById = groupByFlat(
    workflowRules.compositeResponse.map((item) => item.body),
    'Id'
  );

  return workflowRuleRecords.map((workflowRule) => ({
    ...workflowRule,
    ...workflowRuleMetaById[workflowRule.Id],
  }));
}

export async function getFlowsMetadata(selectedOrg: SalesforceOrgUi, sobjects: string[]): Promise<FlowViewRecord[]> {
  // NOTE: this is NOT tooling
  const flowMetadataRecords = (
    await Promise.all(
      splitArrayToMaxSize(sobjects, 300).map((currSobjects) => query<FlowViewRecord>(selectedOrg, getFlowsQuery(currSobjects), false))
    )
  )
    .flatMap(({ queryResults }) => queryResults.records)
    .filter((record) => record.ManageableState === 'unmanaged' || record.IsTemplate);
  return flowMetadataRecords;
}

/**
 * *SPECIAL CASE*
 *
 * Fetch all process builder flows
 * Get latest version of each flow and fetch record metadata
 * Cache the results
 * Update the process builder FlowViewRecord to add the object
 *
 * @param selectedOrg
 * @param apiVersion
 * @param sobjects
 * @returns
 */
export async function getProcessBuildersMetadata(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
  sobjects: string[],
  skipCache?: boolean
) {
  // this list will be filtered based on the sobject and will artificially have TriggerObjectOrEvent.QualifiedApiName added
  const sobjectSet = new Set(sobjects);
  let workflowRuleRecords = (await query<FlowViewRecord>(selectedOrg, getProcessBuildersQuery(), false)).queryResults.records;

  let flowIdToSobject: Record<string, string>;
  const flowIdToSobjectCache = skipCache ? null : await getCacheItemNonHttp<Record<string, string>>(selectedOrg, PROCESS_BUILDER_CACHE_ID);

  if (flowIdToSobjectCache) {
    flowIdToSobject = flowIdToSobjectCache.data;
    processBuilderCachedSince = flowIdToSobjectCache.age;
  } else {
    // Fetch detailed metadata for process builders to figure out which objects they all belong to
    const latestVersions = workflowRuleRecords.map((record) => record.LatestVersionId).filter(Boolean);
    const flowVersionWithMetadata = await getToolingRecords<{ Id: string; FullName: string; DefinitionId: string; Metadata: FlowMetadata }>(
      selectedOrg,
      'Flow',
      latestVersions,
      apiVersion,
      ['Id', 'DefinitionId', 'FullName', 'Metadata']
    );

    const definitionIdsBySObject = flowVersionWithMetadata.compositeResponse
      .map((item) => item.body)
      .reduce((output: Record<string, string>, { Id, DefinitionId, Metadata }) => {
        try {
          if (Metadata) {
            let sobject: string | undefined = undefined;
            if (Metadata.processMetadataValues) {
              const data = Metadata.processMetadataValues
                .filter((value) => value.name === 'ObjectType')
                .map((value) => value.value.stringValue);
              sobject = data[0];
            }
            if (sobject) {
              output[DefinitionId] = sobject;
            }
          }
        } catch (ex) {
          logger.warn('Error processing flow metadata', ex);
          logErrorToRollbar(
            getErrorMessage(ex),
            {
              ...getErrorMessageAndStackObj(ex),
              place: 'AutomationControl',
              type: 'getProcessBuildersMetadata()',
            },
            'warn'
          );
        }
        return output;
      }, {});

    // save cache for org
    flowIdToSobject = definitionIdsBySObject;
    const cachedItem = await saveCacheItemNonHttp(flowIdToSobject, selectedOrg, PROCESS_BUILDER_CACHE_ID);
    cachedItem?.age && (processBuilderCachedSince = cachedItem.age);
  }

  if (!flowIdToSobject) {
    logger.warn('Process Builder metadata cache is missing, this is unexpected');
    return [];
  }

  workflowRuleRecords = workflowRuleRecords
    .filter((record) => flowIdToSobject[record.DurableId] && sobjectSet.has(flowIdToSobject[record.DurableId]))
    .map((record) => ({ ...record, TriggerObjectOrEvent: { QualifiedApiName: flowIdToSobject[record.DurableId] } }));

  return workflowRuleRecords;
}

/**
 * Prepare payload for items and emit data as it comes in
 *
 * @param selectedOrg
 * @param itemsByKey
 */
export function preparePayloads(
  apiVersion: string,
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap
): Observable<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const payloadEvent = new Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>();
  const payloadEvent$ = payloadEvent.asObservable();

  Promise.resolve().then(() => {
    preparePayloadsForDeployment(apiVersion, selectedOrg, itemsByKey, payloadEvent)
      .then(() => {
        payloadEvent.complete();
      })
      .catch((err) => {
        payloadEvent.error(err);
      });
  });

  return payloadEvent$;
}

export async function preparePayloadsForDeployment(
  apiVersion: string,
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap,
  payloadEvent: Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>
) {
  // Duplicate Rules require metadata API
  const duplicateRules = Object.keys(itemsByKey)
    .filter((key) => !itemsByKey[key].deploy.metadataRetrieve && itemsByKey[key].metadata.type === 'DuplicateRule')
    .map((key) => itemsByKey[key]);
  const hasDuplicateRule = duplicateRules.length > 0;
  const baseFields = ['Id', 'FullName', 'Metadata'];

  // Prepare composite requests
  const metadataFetchRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
    Object.keys(itemsByKey)
      .filter((key) => !itemsByKey[key].deploy.metadataRetrieve && itemsByKey[key].metadata.type !== 'DuplicateRule')
      .map((key): CompositeRequestBody => {
        const item = itemsByKey[key].deploy;
        const fields: string[] = item.type === 'ApexTrigger' ? baseFields.concat(['Body', 'ApiVersion']) : baseFields;
        return {
          method: 'GET',
          url: `/services/data/${apiVersion}/tooling/sobjects/${getAutomationDeployType(item.type)}/${item.id}?fields=${fields.join(',')}`,
          referenceId: key,
        };
      }),
    25
  );

  // Initiate metadata API request, then poll for results after all other metadata is fetched
  let fileBasedMetadataRequestId: string | undefined;
  if (hasDuplicateRule) {
    fileBasedMetadataRequestId = await initiateDuplicateRulesMetadataRequest(selectedOrg, duplicateRules);
  }

  // fetch metadata required for deployment using tooling API
  for (const compositeRequest of metadataFetchRequests) {
    const requestBody: CompositeRequest = {
      allOrNone: false,
      compositeRequest,
    };
    const response = await genericRequest<CompositeResponse<MetadataCompositeResponseSuccessOrError>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: requestBody,
    });
    const items = response.compositeResponse.map((item): { key: string; deploymentItem: AutomationControlDeploymentItem } => {
      const deploymentItem = { ...itemsByKey[item.referenceId].deploy };
      if (item.httpStatusCode === 200) {
        deploymentItem.metadataRetrieve = item.body as MetadataCompositeResponseSuccess;
        deploymentItem.metadataDeployRollback = JSON.parse(JSON.stringify({ ...item.body, Id: undefined })) as any;
        deploymentItem.metadataDeploy = JSON.parse(JSON.stringify({ ...item.body, Id: undefined })) as any;
      } else {
        deploymentItem.retrieveError = item.body as MetadataCompositeResponseError[];
      }

      if (deploymentItem.metadataDeploy) {
        switch (deploymentItem.type) {
          case 'ApexTrigger': {
            deploymentItem.metadataDeploy.Metadata.status = deploymentItem.value ? 'Active' : 'Inactive';
            break;
          }
          case 'FlowRecordTriggered':
          case 'FlowProcessBuilder': {
            deploymentItem.metadataDeploy.Metadata.activeVersionNumber = deploymentItem.activeVersionNumber;
            break;
          }
          case 'WorkflowRule':
          case 'ValidationRule': {
            deploymentItem.metadataDeploy.Metadata.active = deploymentItem.value;
            break;
          }
          case 'DuplicateRule': // no tooling API support, handled with metadata api
          default:
            break;
        }
      }

      return { key: item.referenceId, deploymentItem };
    });
    payloadEvent.next(items);
  }

  // Finish waiting for metadata API requests for duplicate rules
  if (fileBasedMetadataRequestId) {
    const results = await pollRetrieveMetadataResultsUntilDone(selectedOrg, fileBasedMetadataRequestId);
    if (results.success && isString(results.zipFile)) {
      const salesforcePackage = await JSZip.loadAsync(results.zipFile, { base64: true });
      const items = await prepareMetadataForDuplicateRules(itemsByKey, salesforcePackage, duplicateRules);
      payloadEvent.next(items);
    } else {
      const items = duplicateRules.map(({ metadata }): { key: string; deploymentItem: AutomationControlDeploymentItem } => ({
        key: metadata.key,
        deploymentItem: {
          ...itemsByKey[metadata.key].deploy,
          retrieveError: [{ message: results.errorMessage || '', errorCode: 'UNKNOWN' }],
        },
      }));
      payloadEvent.next(items);
    }
  }
}

/**
 * Initiate metadata API request for duplicate rules
 *
 * @param selectedOrg
 * @param duplicateRules
 * @returns
 */
async function initiateDuplicateRulesMetadataRequest(selectedOrg: SalesforceOrgUi, duplicateRules: DeploymentItem[]) {
  const listMetadataItems = duplicateRules
    .filter((item) => !item.deploy.metadataRetrieve)
    .map(({ deploy: item, metadata }): ListMetadataResult => {
      const record = metadata.record as DuplicateRuleRecord;
      const fullName = `${record.SobjectType}.${record.DeveloperName}`;
      return {
        createdById: null,
        createdByName: null,
        createdDate: null,
        fileName: `duplicateRules/${fullName}.duplicateRule`,
        fullName,
        id: item.id,
        lastModifiedById: null,
        lastModifiedByName: null,
        lastModifiedDate: null,
        manageableState: record.NamespacePrefix ? 'installed' : 'unmanaged',
        namespacePrefix: null,
        type: 'DuplicateRule',
      };
    });
  return (await retrieveMetadataFromListMetadata(selectedOrg, { DuplicateRule: listMetadataItems })).id;
}

async function prepareMetadataForDuplicateRules(
  itemsByKey: DeploymentItemMap,
  salesforcePackage: JSZip,
  duplicateRules: DeploymentItem[]
): Promise<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const output = [] as { key: string; deploymentItem: AutomationControlDeploymentItem }[];
  for (const duplicateRule of duplicateRules) {
    const record = duplicateRule.metadata.record as DuplicateRuleRecord;
    const deploymentItem = { ...itemsByKey[duplicateRule.metadata.key].deploy };
    const fullName = `${record.SobjectType}.${record.DeveloperName}`;
    const fileName = `duplicateRules/${fullName}.duplicateRule`;
    if (!salesforcePackage.files[fileName]) {
      deploymentItem.retrieveError = [{ message: 'There was an error getting metadata from Salesforce', errorCode: 'MISSING_FILE' }];
      output.push({ key: duplicateRule.metadata.key, deploymentItem });
      continue;
    }
    const fileContent = await salesforcePackage.file(fileName)?.async('string');
    const metadata: MetadataCompositeResponseSuccess = {
      FullName: fullName,
      Metadata: fileContent,
    };
    deploymentItem.metadataRetrieve = metadata;
    deploymentItem.metadataDeployRollback = { ...metadata };
    deploymentItem.metadataDeploy = { ...metadata };
    const replaceSource = deploymentItem.value ? `<isActive>false</isActive>` : `<isActive>true</isActive>`;
    const replaceTarget = deploymentItem.value ? `<isActive>true</isActive>` : `<isActive>false</isActive>`;
    deploymentItem.metadataDeploy.Metadata = (deploymentItem.metadataDeploy.Metadata as string).replace(replaceSource, replaceTarget);
    output.push({ key: duplicateRule.metadata.key, deploymentItem });
  }
  return output;
}

export function deployMetadata(
  apiVersion: string,
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap
): Observable<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const payloadEvent = new Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>();
  const payloadEvent$ = payloadEvent.asObservable();

  // ensure next tick so that events do not emit prior to observable subscription
  Promise.resolve().then(async () => {
    try {
      // items with prior errors are not deployed
      const idToKeyMap = Object.keys(itemsByKey)
        .filter((key) => !itemsByKey[key].deploy.deployError)
        .reduce((output: Record<string, string>, key) => {
          output[itemsByKey[key].deploy.id] = key;
          return output;
        }, {});

      const metadataUpdateRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
        Object.keys(itemsByKey)
          .filter((key) => !itemsByKey[key].deploy.retrieveError && !itemsByKey[key].deploy.requireMetadataApi)
          .map((key): CompositeRequestBody => {
            const item = itemsByKey[key].deploy;
            return {
              method: 'PATCH',
              url: `/services/data/${apiVersion}/tooling/sobjects/${getAutomationDeployType(item.type)}/${item.id}`,
              referenceId: item.id,
              body: item.metadataDeploy,
            };
          }),
        25
      );

      for (const compositeRequest of metadataUpdateRequests) {
        const requestBody: CompositeRequest = {
          allOrNone: false,
          compositeRequest,
        };

        const response = await genericRequest<CompositeResponse<MetadataCompositeResponseSuccessOrError>>(selectedOrg, {
          isTooling: true,
          method: 'POST',
          url: `/services/data/${apiVersion}/tooling/composite`,
          body: requestBody,
        });
        const items = response.compositeResponse.map((item): { key: string; deploymentItem: AutomationControlDeploymentItem } => {
          const key = idToKeyMap[item.referenceId];
          const deploymentItem: AutomationControlDeploymentItem = { ...itemsByKey[key].deploy };
          if (item.httpStatusCode > 299) {
            deploymentItem.deployError = item.body as MetadataCompositeResponseError[];
          }
          return { key, deploymentItem };
        });
        payloadEvent.next(items);
      }

      // perform deployments that are not supported using tooling api
      const metadataDeployResults = await deployMetadataFileBased(selectedOrg, itemsByKey, Number(apiVersion.replace(/[^0-9.]/g, '')));

      if (metadataDeployResults) {
        const deployResults = await pollMetadataResultsUntilDone(selectedOrg, metadataDeployResults.deployResultsId, {
          includeDetails: true,
        });
        payloadEvent.next(
          metadataDeployResults.metadataItems.map((key) => {
            const output = { key, deploymentItem: { ...itemsByKey[key].deploy } };
            const failureItem = deployResults.details?.componentFailures.find(
              (item) => item.fullName === itemsByKey[key].deploy.metadataDeploy?.FullName
            );

            if (failureItem) {
              output.deploymentItem.deployError = [
                {
                  errorCode: failureItem.problemType,
                  message: failureItem.problem,
                },
              ];
              return output;
            }

            // everything failed, regardless of success/failure
            if (!deployResults.success) {
              output.deploymentItem.deployError = [
                {
                  errorCode: 'UNKNOWN_ERROR',
                  message: 'Error deploying to Salesforce',
                },
              ];
            }
            return output;
          })
        );
      }

      payloadEvent.complete();
    } catch (ex) {
      payloadEvent.error(ex);
    }
  });

  return payloadEvent$;
}

export async function deployMetadataFileBased(
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap,
  apiVersion: number
): Promise<{ deployResultsId: string; metadataItems: string[] } | null> {
  const fileBasedMetadataItems = Object.keys(itemsByKey).filter(
    (key) => !itemsByKey[key].deploy.retrieveError && itemsByKey[key].deploy.requireMetadataApi
  );

  if (fileBasedMetadataItems.length === 0) {
    return null;
  }

  const deployItems: Record<
    string,
    {
      fullName: string;
      dirPath: string;
      files: {
        name: string;
        content: string;
      }[];
    }[]
  > = {};

  // prepare data to build XML
  fileBasedMetadataItems.forEach((key) => {
    const item = itemsByKey[key];
    switch (item.deploy.type) {
      case 'ApexTrigger': {
        deployItems['ApexTrigger'] = deployItems['ApexTrigger'] || [];
        deployItems['ApexTrigger'].push({
          fullName: (item.metadata.record as ToolingApexTriggerRecord).Name,
          dirPath: 'triggers',
          files: [
            {
              name: `${(item.metadata.record as ToolingApexTriggerRecord).Name}.trigger`,
              content: item.deploy.metadataDeploy?.Body || '',
            },
            {
              name: `${(item.metadata.record as ToolingApexTriggerRecord).Name}.trigger-meta.xml`,
              content: [
                `<?xml version="1.0" encoding="UTF-8"?>`,
                `<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata">`,
                `\t<apiVersion>${item.deploy.metadataRetrieve?.ApiVersion || Number(apiVersion)}.0</apiVersion>`,
                `\t<status>${item.deploy.metadataDeploy?.Metadata.status || ''}</status>`,
                `</ApexTrigger>`,
              ].join('\n'),
            },
          ],
        });
        break;
      }
      case 'DuplicateRule': {
        if (!item.deploy.metadataDeploy) {
          break;
        }
        deployItems['DuplicateRule'] = deployItems['DuplicateRule'] || [];
        deployItems['DuplicateRule'].push({
          fullName: item.deploy.metadataDeploy.FullName,
          dirPath: 'duplicateRules',
          files: [
            {
              name: `${item.deploy.metadataDeploy.FullName}.duplicateRule`,
              content: item.deploy.metadataDeploy.Metadata,
            },
          ],
        });
        break;
      }
      default:
        break;
    }
  });

  const packageXml = [`<?xml version="1.0" encoding="UTF-8"?>`, `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`];

  Object.keys(deployItems).forEach((key) => {
    packageXml.push('\t<types>');
    deployItems[key].forEach((item) => packageXml.push(`\t\t<members>${item.fullName}</members>`));
    packageXml.push(`\t\t<name>${key}</name>`);
    packageXml.push('\t</types>');
  });

  packageXml.push(`\t<version>${apiVersion}.0</version>`);
  packageXml.push('</Package>');

  const files: { fullFilename: string; content: string }[] = [{ fullFilename: 'package.xml', content: packageXml.join('\n') }];

  Object.keys(deployItems).forEach((key) => {
    deployItems[key].forEach((item) => {
      item.files.forEach(({ content, name }) => {
        files.push({ fullFilename: `${item.dirPath}/${name}`, content });
      });
    });
  });

  // deploy file
  const deployResults = await deployMetadataZip(selectedOrg, files, {
    singlePackage: true,
    rollbackOnError: getOrgType(selectedOrg) === 'Production',
  });
  // id is only field not deprecated
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_asyncresult.htm
  logger.info('deployResults', deployResults);
  return { deployResultsId: deployResults.id, metadataItems: fileBasedMetadataItems };
}

export function getAdditionalItemsWorkflowRuleText(recordMetadata: MetadataWorkflowRuleRecord): TableItemAdditionalData[] {
  const output: TableItemAdditionalData[] = [];
  const { actions, formula, booleanFilter, criteriaItems, workflowTimeTriggers } = recordMetadata;

  if (formula || (Array.isArray(criteriaItems) && criteriaItems.length > 0)) {
    output.push({
      label: 'Criteria',
      value: '',
    });
    if (formula) {
      output.push({
        label: 'Formula',
        value: formula,
      });
    } else if (Array.isArray(criteriaItems) && criteriaItems.length > 0) {
      if (booleanFilter) {
        output.push({
          label: 'Filter',
          value: booleanFilter,
        });
      }
      criteriaItems.forEach(({ field, operation, value }, i) => {
        output.push({
          label: `${i + 1}.`,
          value: `${field} ${operation} ${value ?? 'null'}`,
        });
      });
    }
  }

  if (Array.isArray(actions) && actions.length > 0) {
    output.push({
      label: 'Immediate Actions',
      value: '',
    });
    actions.forEach((action) => output.push({ label: action.type, value: action.name }));
  }

  if (Array.isArray(workflowTimeTriggers) && workflowTimeTriggers.length > 0) {
    output.push({
      label: 'Time-based Actions',
      value: '',
    });

    workflowTimeTriggers.forEach((timeTrigger) => {
      output.push({
        label: `${timeTrigger.timeLength} ${timeTrigger.workflowTimeTriggerUnit} ${timeTrigger.offsetFromField || ''}`,
        value: '',
      });
      timeTrigger.actions.forEach((action) => output.push({ label: action.type, value: action.name }));
    });
  }

  return output;
}
