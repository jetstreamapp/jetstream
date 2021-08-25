// LAME

import { logger } from '@jetstream/shared/client-logger';
import { deployMetadata as deployMetadataZip, genericRequest, query } from '@jetstream/shared/data';
import { getToolingRecords, logErrorToRollbar, pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { getMapOf, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CompositeRequest, CompositeRequestBody, CompositeResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Observable, Subject } from 'rxjs';
import {
  AutomationControlDeploymentItem,
  DeploymentItemMap,
  FlowMetadata,
  MetadataCompositeResponseError,
  MetadataCompositeResponseSuccess,
  MetadataCompositeResponseSuccessOrError,
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
  apiVersion: string,
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
    validationRuleRecords.map((record) => record.Id),
    apiVersion
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
export async function getWorkflowRulesMetadata(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
  sobject: string
): Promise<ToolingWorkflowRuleRecord[]> {
  const workflowRuleRecords = (await query<ToolingWorkflowRuleRecord>(selectedOrg, getWorkflowRuleQuery(sobject), true)).queryResults
    .records;

  if (workflowRuleRecords.length === 0) {
    return [];
  }

  const workflowRules = await getToolingRecords<ToolingWorkflowRuleRecord>(
    selectedOrg,
    'WorkflowRule',
    workflowRuleRecords.map((record) => record.Id),
    apiVersion
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
 * @returns process builders / record triggered flows
 */
export async function getFlows(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
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
      apiVersion,
      ['Id', 'DefinitionId', 'FullName', 'Metadata']
    );

    const invalidResponses = response.compositeResponse.filter((response) => response.httpStatusCode !== 200);
    if (invalidResponses.length > 0) {
      logErrorToRollbar('Invalid flow responses', {
        place: 'AutomationControl',
        type: 'getFlows()',
        invalidResponses,
      });
      throw new Error('There were errors obtaining the flow metadata from Salesforce');
    }
    flowDefinitionsBySobject = response.compositeResponse.reduce((output: MapOf<string[]>, record) => {
      try {
        if (record.body.Metadata) {
          let sobject: string;
          if (record.body.Metadata.processType === 'AutoLaunchedFlow') {
            sobject = record.body.Metadata.start?.object;
          } else if (record.body.Metadata.processMetadataValues) {
            const data = record.body.Metadata.processMetadataValues
              .filter((value) => value.name === 'ObjectType')
              .map((value) => value.value.stringValue);
            sobject = data[0];
          }
          if (sobject) {
            output[sobject] = output[sobject] || [];
            output[sobject].push(record.body.DefinitionId);
          }
        }
      } catch (ex) {
        logErrorToRollbar(ex.message, {
          stack: ex.stack,
          place: 'AutomationControl',
          type: 'getFlows()',
          record,
        });
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
  // SFDC referenceId for composite cannot contain "." - this is an alternate way to lookup the key
  const idToKeyMap: MapOf<string> = Object.keys(itemsByKey).reduce((output, key) => {
    output[itemsByKey[key].deploy.id] = key;
    return output;
  }, {});

  const baseFields = ['Id', 'FullName', 'Metadata'];
  // Prepare composite requests
  const metadataFetchRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
    Object.keys(itemsByKey)
      .filter((key) => !itemsByKey[key].deploy.metadataRetrieve)
      .map(
        (key): CompositeRequestBody => {
          const item = itemsByKey[key].deploy;
          const fields: string[] = item.type === 'ApexTrigger' ? baseFields.concat(['Body', 'ApiVersion']) : baseFields;

          return {
            method: 'GET',
            url: `/services/data/${apiVersion}/tooling/sobjects/${item.type}/${item.id}?fields=${fields.join(',')}`,
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
    const response = await genericRequest<CompositeResponse<MetadataCompositeResponseSuccessOrError>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: requestBody,
    });
    const items = response.compositeResponse.map((item): { key: string; deploymentItem: AutomationControlDeploymentItem } => {
      const key = idToKeyMap[item.referenceId];
      const deploymentItem: AutomationControlDeploymentItem = { ...itemsByKey[key].deploy };
      if (item.httpStatusCode === 200) {
        deploymentItem.metadataRetrieve = item.body as MetadataCompositeResponseSuccess;
        deploymentItem.metadataDeployRollback = JSON.parse(JSON.stringify({ ...item.body, Id: undefined })) as any;
        deploymentItem.metadataDeploy = JSON.parse(JSON.stringify({ ...item.body, Id: undefined })) as any;
      } else {
        deploymentItem.retrieveError = item.body as MetadataCompositeResponseError[];
      }

      switch (deploymentItem.type) {
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
  apiVersion: string,
  selectedOrg: SalesforceOrgUi,
  itemsByKey: DeploymentItemMap
): Observable<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]> {
  const payloadEvent = new Subject<{ key: string; deploymentItem: AutomationControlDeploymentItem }[]>();
  const payloadEvent$ = payloadEvent.asObservable();

  // ensure next tick so that events do not emit prior to observable subscription
  Promise.resolve().then(async () => {
    try {
      const idToKeyMap: MapOf<string> = Object.keys(itemsByKey).reduce((output, key) => {
        output[itemsByKey[key].deploy.id] = key;
        return output;
      }, {});

      const metadataUpdateRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
        Object.keys(itemsByKey)
          .filter((key) => !itemsByKey[key].deploy.retrieveError && !itemsByKey[key].deploy.requireMetadataApi)
          .map(
            (key): CompositeRequestBody => {
              const item = itemsByKey[key].deploy;
              return {
                method: 'PATCH',
                url: `/services/data/${apiVersion}/tooling/sobjects/${item.type}/${item.id}`,
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
      const metadataDeployResults = await deployMetadataFileBased(selectedOrg, itemsByKey, Number(apiVersion));

      if (metadataDeployResults) {
        const deployResults = await pollMetadataResultsUntilDone(selectedOrg, metadataDeployResults.deployResultsId);
        payloadEvent.next(metadataDeployResults.metadataItems.map((key) => ({ key, deploymentItem: { ...itemsByKey[key].deploy } })));
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

  const deployItems: MapOf<
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
      case 'ApexTrigger':
        deployItems['ApexTrigger'] = deployItems['ApexTrigger'] || [];
        deployItems['ApexTrigger'].push({
          fullName: item.metadata.fullName,
          dirPath: 'triggers',
          files: [
            {
              name: `${item.metadata.fullName}.trigger`,
              content: item.deploy.metadataDeploy.Body,
            },
            {
              name: `${item.metadata.fullName}.trigger-meta.xml`,
              content: [
                `<?xml version="1.0" encoding="UTF-8"?>`,
                `<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata">`,
                `\t<apiVersion>${item.deploy.metadataRetrieve.ApiVersion || Number(apiVersion)}.0</apiVersion>`,
                `\t<status>${item.deploy.metadataDeploy.Metadata.status}</status>`,
                `</ApexTrigger>`,
              ].join('\n'),
            },
          ],
        });
        break;
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
  const deployResults = await deployMetadataZip(selectedOrg, files, { singlePackage: true, rollbackOnError: true });
  // id is only field not deprecated
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_asyncresult.htm
  logger.info('deployResults', deployResults);
  return { deployResultsId: deployResults.id, metadataItems: fileBasedMetadataItems };
}
