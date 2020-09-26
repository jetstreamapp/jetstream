// LAME

import { genericRequest, query } from '@jetstream/shared/data';
import { getToolingRecords } from '@jetstream/shared/ui-utils';
import { getMapOf, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CompositeRequest, CompositeRequestBody, CompositeResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Observable, Subject } from 'rxjs';
import {
  AutomationControlDeploymentItem,
  DeploymentItemMap,
  FlowMetadata,
  ToolingFlowAggregateRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from '../automation-control-types';
import { getFlowsQuery, getLatestFlowDefinitionIds, getValidationRuleQuery, getWorkflowRuleQuery } from './automation-control-soql-utils';

/**
 * Adds FullName and Metadata fields to existing WFR records and returns a new array
 *
 * @param selectedOrg
 * @param validationRuleRecords
 */
export async function getValidationRulesMetadata(
  selectedOrg: SalesforceOrgUi,
  entityDefinitionId: string
): Promise<ToolingValidationRuleRecord[]> {
  const validationRuleRecords = (await query<ToolingWorkflowRuleRecord>(selectedOrg, getValidationRuleQuery(entityDefinitionId), true))
    .queryResults.records;

  if (validationRuleRecords.length === 0) {
    return [];
  }
  const validationRules = await getToolingRecords<ToolingValidationRuleRecord>(
    selectedOrg,
    'ValidationRule',
    validationRuleRecords.map((record) => record.Id)
  );
  const validationRuleMetaById = getMapOf(
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
export async function getWorkflowRulesMetadata(selectedOrg: SalesforceOrgUi, sobject: string): Promise<ToolingWorkflowRuleRecord[]> {
  const workflowRuleRecords = (await query<ToolingWorkflowRuleRecord>(selectedOrg, getWorkflowRuleQuery(sobject), true)).queryResults
    .records;

  if (workflowRuleRecords.length === 0) {
    return [];
  }

  const workflowRules = await getToolingRecords<ToolingWorkflowRuleRecord>(
    selectedOrg,
    'WorkflowRule',
    workflowRuleRecords.map((record) => record.Id)
  );

  const workflowRuleMetaById = getMapOf(
    workflowRules.compositeResponse.map((item) => item.body),
    'Id'
  );

  return workflowRuleRecords.map((workflowRule) => ({
    ...workflowRule,
    ...workflowRuleMetaById[workflowRule.Id],
  }));
}

/**
 * Gets FlowDefinition with a subquery of FlowVersions
 *
 * Fetches all metadata using composite requests (Slow) and returns all the data
 * the slow fetch only needs to happen once, then the results can be used for all
 * subsequent object requests
 *
 * @param selectedOrg
 * @param sobject
 * @param flowDefinitionsBySobject
 * @returns process builders
 */
export async function getProcessBuilders(
  selectedOrg: SalesforceOrgUi,
  sobject: string,
  flowDefinitionsBySobject: MapOf<string[]> | null
): Promise<{
  flowDefinitionsBySobject: MapOf<string[]>;
  flows: ToolingFlowDefinitionWithVersions[];
}> {
  /**
   * If we do not have a cached response already, then get all metadata
   *
   * This includes ALL flows in the org
   */
  if (!flowDefinitionsBySobject) {
    flowDefinitionsBySobject = flowDefinitionsBySobject || {};
    const flowDependencyOnSobjectResults = await query<ToolingFlowAggregateRecord>(selectedOrg, getLatestFlowDefinitionIds(), true);

    const recordIds = flowDependencyOnSobjectResults.queryResults.records.map((item) => item.MostRecentId);
    const response = await getToolingRecords<{ Id: string; DefinitionId: string; FullName: string; Metadata: FlowMetadata }>(
      selectedOrg,
      'Flow',
      recordIds,
      ['Id', 'DefinitionId', 'FullName', 'Metadata']
    );

    const invalidResponses = response.compositeResponse.filter((response) => response.httpStatusCode !== 200);
    if (invalidResponses.length > 0) {
      throw new Error('There were errors obtaining the process builder metadata from Salesforce');
    }
    flowDefinitionsBySobject = response.compositeResponse.reduce((output: MapOf<string[]>, record) => {
      const [sobject] = record.body.Metadata.processMetadataValues
        .filter((value) => value.name === 'ObjectType')
        .map((value) => value.value.stringValue);
      if (sobject) {
        output[sobject] = output[sobject] || [];
        output[sobject].push(record.body.DefinitionId);
      }
      return output;
    }, flowDefinitionsBySobject);
  }

  const flowDefinitionIds = flowDefinitionsBySobject[sobject];
  // re-query everything that we need and combine into the correct data structure
  if (flowDefinitionIds && flowDefinitionIds.length > 0) {
    const flowDefinitionResults = await query<ToolingFlowDefinitionWithVersions>(selectedOrg, getFlowsQuery(flowDefinitionIds), true);

    if (flowDefinitionResults.queryResults.totalSize > 0) {
      const flowDefinitions = flowDefinitionResults.queryResults.records.map((record) => {
        if (record.Versions) {
          record.Versions = (record.Versions as any).records;
        } else {
          record.Versions = [];
        }
        return record;
      });

      return { flows: flowDefinitions, flowDefinitionsBySobject };
    }
  }

  // There are no flow versions for the selected SObject
  return { flows: [], flowDefinitionsBySobject };
}

/**
 * Prepare payload for items and emit data as it comes in
 *
 * @param selectedOrg
 * @param itemsByKey
 */
export function preparePayloads(
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap
): Observable<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const payloadEvent = new Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>();
  const payloadEvent$ = payloadEvent.asObservable();

  Promise.resolve().then(() => {
    preparePayloadsForDeployment(selectedOrg, itemsByKey, payloadEvent)
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
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap,
  payloadEvent: Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>
) {
  // SFDC referenceId for composite cannot contain "." - this is an alternate way to lookup the key
  const idToKeyMap: MapOf<string> = Object.keys(itemsByKey).reduce((output, key) => {
    output[itemsByKey[key].deploy.id] = key;
    return output;
  }, {});

  // Prepare composite requests
  const metadataFetchRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
    Object.keys(itemsByKey)
      .filter((key) => !itemsByKey[key].deploy.metadataRetrieve)
      .map(
        (key): CompositeRequestBody => {
          const item = itemsByKey[key].deploy;
          return {
            method: 'GET',
            url: `/services/data/v49.0/tooling/sobjects/${item.type}/${item.id}?fields=Id,FullName,Metadata`,
            referenceId: item.id,
          };
        }
      ),
    25
  );

  // fetch metadata required for deployment
  for (const compositeRequest of metadataFetchRequests) {
    const requestBody: CompositeRequest = {
      allOrNone: false,
      compositeRequest,
    };
    // FIXME: remove hard-coded version number
    const response = await genericRequest<CompositeResponse<{ Id: string; FullName: string; Metadata: FlowMetadata }>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: '/services/data/v49.0/tooling/composite',
      body: requestBody,
    });
    const items = response.compositeResponse.map((item): { key: string; deploymentItem: AutomationControlDeploymentItem } => {
      const key = idToKeyMap[item.referenceId];
      const deploymentItem: AutomationControlDeploymentItem = { ...itemsByKey[key].deploy };
      if (item.httpStatusCode === 200) {
        deploymentItem.metadataRetrieve = item.body;
        deploymentItem.metadataDeploy = JSON.parse(JSON.stringify({ ...item.body, Id: undefined })) as any;
      } else {
        deploymentItem.retrieveError = item.body as any;
      }

      switch (deploymentItem.type) {
        // FIXME:
        /**
          Apex triggers cannot be deactivated using Tooling API.
          You can deactivate Apex triggers using Metadata API.
          Consider using custom metadata records and include logic in your trigger to bypass trigger configuration logic.
          For more information, see the Metadata API Developer Guide.
         */

        case 'ApexTrigger': {
          deploymentItem.metadataDeploy.Metadata.status = deploymentItem.value ? 'Active' : 'Inactive';
          break;
        }
        case 'FlowDefinition': {
          deploymentItem.metadataDeploy.Metadata.activeVersionNumber = deploymentItem.activeVersion;
          break;
        }
        case 'WorkflowRule':
        case 'ValidationRule': {
          deploymentItem.metadataDeploy.Metadata.active = deploymentItem.value;
          break;
        }
        default:
          break;
      }

      return { key, deploymentItem };
    });
    payloadEvent.next(items);
  }
}

export function deployMetadata(
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap
): Observable<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const payloadEvent = new Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>();
  const payloadEvent$ = payloadEvent.asObservable();

  Promise.resolve().then(async () => {
    try {
      const idToKeyMap: MapOf<string> = Object.keys(itemsByKey).reduce((output, key) => {
        output[itemsByKey[key].deploy.id] = key;
        return output;
      }, {});

      // TODO: handle apex triggers!
      const metadataUpdateRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
        Object.keys(itemsByKey)
          .filter((key) => !itemsByKey[key].deploy.retrieveError)
          .map(
            (key): CompositeRequestBody => {
              const item = itemsByKey[key].deploy;
              return {
                method: 'PATCH',
                url: `/services/data/v49.0/tooling/sobjects/${item.type}/${item.id}`,
                referenceId: item.id,
                body: item.metadataDeploy,
              };
            }
          ),
        25
      );

      for (const compositeRequest of metadataUpdateRequests) {
        const requestBody: CompositeRequest = {
          allOrNone: false,
          compositeRequest,
        };
        // FIXME: remove hard-coded version number
        const response = await genericRequest<CompositeResponse<{ Id: string; FullName: string; Metadata: FlowMetadata }>>(selectedOrg, {
          isTooling: true,
          method: 'POST',
          url: '/services/data/v49.0/tooling/composite',
          body: requestBody,
        });
        const items = response.compositeResponse.map((item): { key: string; deploymentItem: AutomationControlDeploymentItem } => {
          const key = idToKeyMap[item.referenceId];
          const deploymentItem: AutomationControlDeploymentItem = { ...itemsByKey[key].deploy };
          if (item.httpStatusCode > 299) {
            deploymentItem.deployError = item.body;
          }
          return { key, deploymentItem };
        });
        payloadEvent.next(items);
      }
      payloadEvent.complete();
    } catch (ex) {
      payloadEvent.error(ex);
    }
  });

  return payloadEvent$;
}
