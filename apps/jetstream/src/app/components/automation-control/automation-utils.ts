// LAME

import { logger } from '@jetstream/shared/client-logger';
import { genericRequest, query, readMetadata } from '@jetstream/shared/data';
import { ensureBoolean, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CompositeRequest, CompositeRequestBody, CompositeResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
import isNil from 'lodash/isNil';
import { composeQuery, getField } from 'soql-parser-js';
import {
  AutomationControlMetadataTypeItem,
  AutomationControlParentSobject,
  AutomationMetadataDeployType,
  FlowMetadata,
  MetadataWorkflowRuleRecord,
  ToolingApexTriggerRecord,
  ToolingEntityDefinitionRecord,
  ToolingFlowAggregateRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingFlowRecord,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
  ToolingWorkflowRuleRecordWithMetadata,
} from './automation-control-types';

export function initItemsById(sobjects: ToolingEntityDefinitionRecord[]): [string[], MapOf<AutomationControlParentSobject>] {
  const itemIdsTemp: string[] = [];
  const itemsByIdTemp = sobjects.reduce((output: MapOf<AutomationControlParentSobject>, sobject) => {
    itemIdsTemp.push(sobject.QualifiedApiName);
    output[sobject.QualifiedApiName] = {
      key: sobject.QualifiedApiName,
      entityDefinitionId: sobject.Id,
      entityDefinitionRecord: sobject,
      sobjectName: sobject.QualifiedApiName,
      sobjectLabel: sobject.MasterLabel,
      loading: false,
      hasLoaded: false,
      inProgress: false,
      error: null,
      automationItems: {
        ValidationRule: {
          metadataType: 'ValidationRule',
          loading: false,
          hasLoaded: true,
          expanded: true,
          items: sobject.ValidationRules
            ? convertValidationRuleRecordsToAutomationControlItem(sobject.QualifiedApiName, sobject.ValidationRules.records)
            : [],
        },
        WorkflowRule: {
          metadataType: 'WorkflowRule',
          loading: false,
          hasLoaded: false,
          expanded: true,
          items: [],
        },
        Flow: {
          metadataType: 'Flow',
          loading: false,
          hasLoaded: false,
          expanded: true,
          items: [],
        },
        ApexTrigger: {
          metadataType: 'ApexTrigger',
          loading: false,
          hasLoaded: true,
          expanded: true,
          items: sobject.ApexTriggers ? convertApexTriggerRecordsToAutomationControlItem(sobject.ApexTriggers.records) : [],
        },
      },
    };
    return output;
  }, {});
  return [itemIdsTemp, itemsByIdTemp];
}

export function convertApexTriggerRecordsToAutomationControlItem(
  records: ToolingApexTriggerRecord[]
): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord> => ({
      fullName: encodeURIComponent(record.Name),
      label: record.Name,
      description: '',
      currentValue: record.Status === 'Active',
      initialValue: record.Status === 'Active',
      metadata: record,
    })
  );
}

export function convertValidationRuleRecordsToAutomationControlItem(
  sobjectName: string,
  records: ToolingValidationRuleRecord[]
): AutomationControlMetadataTypeItem<ToolingValidationRuleRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingValidationRuleRecord> => ({
      fullName: encodeURIComponent(`${sobjectName}.${record.ValidationName}`),
      label: record.ValidationName,
      description: record.Description,
      currentValue: record.Active,
      initialValue: record.Active,
      metadata: record,
    })
  );
}

export function convertWorkflowRuleRecordsToAutomationControlItem(
  records: ToolingWorkflowRuleRecordWithMetadata[]
): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata> => ({
      fullName: record.metadata.fullName,
      label: record.tooling.Name,
      description: record.metadata.description,
      currentValue: record.metadata.active,
      initialValue: record.metadata.active,
      metadata: record,
    })
  );
}

export function convertFlowRecordsToAutomationControlItem(
  records: ToolingFlowDefinitionWithVersions[]
): AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord> => ({
      fullName: record.DeveloperName,
      // MasterLabel is only populated if flow has an active version
      label: `${record.DeveloperName}`,
      description: '',
      // TODO: do we need to do something different with these?
      // versions are what gets set to active
      currentValue: !!record.ActiveVersionId,
      initialValue: !!record.ActiveVersionId,
      currentActiveVersion: record.ActiveVersion?.VersionNumber || null,
      initialActiveVersion: record.ActiveVersion?.VersionNumber || null,
      expanded: false,
      children: Array.isArray(record.Versions)
        ? record.Versions.map((version) => ({
            fullName: version.Id, // not full name in this case
            label: version.MasterLabel,
            description: version.Description,
            currentValue: version.Status === 'Active',
            initialValue: version.Status === 'Active',
            metadata: version,
          }))
        : [],
      metadata: record,
    })
  );
}

/**
 * Get all workflow rules for the specified SObject
 * @param selectedOrg
 * @param sobject
 */
export async function getWorkflowRulesMetadata(
  selectedOrg: SalesforceOrgUi,
  sobject: string
): Promise<ToolingWorkflowRuleRecordWithMetadata[]> {
  const workflowRules = await query<ToolingWorkflowRuleRecord>(selectedOrg, getWorkflowRuleQuery(sobject), true);

  if (workflowRules.queryResults.totalSize > 0) {
    const workflowRulesByFullName = workflowRules.queryResults.records.reduce((output, item) => {
      output[`${sobject}.${item.Name}`] = item;
      return output;
    }, {});
    const workflowRulesWithToolingAndMetadata = (
      await readMetadata<MetadataWorkflowRuleRecord>(
        selectedOrg,
        'WorkflowRule',
        workflowRules.queryResults.records.map((workflowRule) => `${workflowRule.TableEnumOrId}.${workflowRule.Name}`)
      )
    ).map(
      (item): ToolingWorkflowRuleRecordWithMetadata => {
        item.active = ensureBoolean(item.active);
        return {
          tooling: workflowRulesByFullName[item.fullName],
          metadata: item,
        };
      }
    );

    return workflowRulesWithToolingAndMetadata;
  }
  return [];
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
   */
  if (!flowDefinitionsBySobject) {
    flowDefinitionsBySobject = flowDefinitionsBySobject || {};
    const flowDependencyOnSobjectResults = await query<ToolingFlowAggregateRecord>(selectedOrg, getLatestFlowDefinitionIds(), true);
    const recordSets = splitArrayToMaxSize(flowDependencyOnSobjectResults.queryResults.records, 25);

    /**
     * Composite request allows up to 25 records to be processed at once
     * Using a for loop to allow async/await - serially process results and combine them into flowDefinitionsBySobject
     */
    for (const records of recordSets) {
      // get ids, build aggregate request
      const requestBody: CompositeRequest = {
        allOrNone: false,
        compositeRequest: records.map(
          ({ MostRecentId: referenceId }): CompositeRequestBody => ({
            method: 'GET',
            url: `/services/data/v49.0/tooling/sobjects/Flow/${referenceId}?fields=Id,DefinitionId,FullName,Metadata`,
            referenceId,
          })
        ),
      };
      const response = await genericRequest<
        CompositeResponse<{ Id: string; DefinitionId: string; FullName: string; Metadata: FlowMetadata }>
      >(selectedOrg, {
        isTooling: true,
        method: 'POST',
        url: '/services/data/v49.0/tooling/composite',
        body: requestBody,
      });
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

interface DeployPrePayload {
  type: AutomationMetadataDeployType;
  id: string;
  activeVersion?: number; // only applies to process builders
  value: boolean;
  metadataRetrieve?: { Id: string; FullName: string; Metadata: any };
  metadataDeploy?: { FullName: string; Metadata: any };
  retrieveError?: any;
  deployError?: any;
}

// only dirty items should be passed in - every item passed in
export function preparePayloads(
  itemsById: MapOf<AutomationControlParentSobject>
): {
  validationRules: DeployPrePayload[];
  workflowRules: DeployPrePayload[];
  apexTriggers: DeployPrePayload[];
  processBuilders: DeployPrePayload[];
} {
  const validationRulesMetadata: DeployPrePayload[] = Object.values(itemsById).flatMap((item) =>
    item.automationItems.ValidationRule.items
      .filter((childItem) => childItem.initialValue !== childItem.currentValue)
      .map((childItem): DeployPrePayload => ({ id: childItem.metadata.Id, value: childItem.currentValue, type: 'ValidationRule' }))
  );

  // TODO: get full metadata
  const workflowRulesMetadata: DeployPrePayload[] = Object.values(itemsById).flatMap((item) =>
    item.automationItems.WorkflowRule.items
      .filter((childItem) => childItem.initialValue !== childItem.currentValue)
      .map(
        (childItem): DeployPrePayload => ({
          id: childItem.metadata.tooling.Id,
          value: childItem.currentValue,
          type: 'WorkflowRule',
          metadataRetrieve: {
            Id: childItem.metadata.tooling.Id,
            FullName: childItem.metadata.metadata.fullName,
            Metadata: { ...childItem.metadata.metadata },
          },
          metadataDeploy: {
            FullName: childItem.metadata.metadata.fullName,
            Metadata: { ...childItem.metadata.metadata },
          },
        })
      )
  );

  const apexTriggersMetadata: DeployPrePayload[] = Object.values(itemsById).flatMap((item) =>
    item.automationItems.ApexTrigger.items
      .filter((childItem) => childItem.initialValue !== childItem.currentValue)
      .map((childItem): DeployPrePayload => ({ id: childItem.metadata.Id, value: childItem.currentValue, type: 'ApexTrigger' }))
  );

  const processBuildersMetadata: DeployPrePayload[] = Object.values(itemsById).flatMap((item) =>
    item.automationItems.Flow.items
      .filter(
        (childItem) =>
          childItem.initialValue !== childItem.currentValue || childItem.initialActiveVersion !== childItem.currentActiveVersion
      )
      .map(
        (childItem): DeployPrePayload => ({
          id: childItem.metadata.Id,
          value: childItem.currentValue,
          type: 'FlowDefinition',
          activeVersion: isNil(childItem.currentValue)
            ? null
            : childItem.children
                .filter((grandChildItem) => grandChildItem.currentValue)
                .map((grandChildItem) => grandChildItem.metadata.VersionNumber)[0],
        })
      )
  );

  return {
    validationRules: validationRulesMetadata,
    workflowRules: workflowRulesMetadata,
    apexTriggers: apexTriggersMetadata,
    processBuilders: processBuildersMetadata,
  };
}

// TODO: this should have better types - just here to get things going
export async function deployChanges(selectedOrg: SalesforceOrgUi, itemsById: MapOf<AutomationControlParentSobject>) {
  const PayloadItems = preparePayloads(itemsById);
  const { validationRules, workflowRules, apexTriggers, processBuilders } = PayloadItems;
  logger.log('[PREPARED ITEMS]', PayloadItems);

  /**
   * TODO:
   * NOTE: ALL metadata fields must be provided or else they are over-written
   * there is no such thing as a partial update :sob:
   *
   * This means that we need to get the metadata for EVERY item
   * OPTIONS:
   * - fetch ALL metadata up-front (like we do for process builders) - but this will add time even if user never toggles items
   * - Read all first, then update and send back
   * - Composite fetch/update together (we have to hard-code every key)
   * - readMetadata (sucks because XML conversion is horrid)
   * - file-based metadata (sucks because XML conversion is horrid and requires)
   */

  // used to add the metadata property to each item
  const metadataItemById = Object.values(PayloadItems).reduce((itemById: MapOf<DeployPrePayload>, metadataType) => {
    metadataType.forEach((item) => {
      itemById[item.id] = item;
    });
    return itemById;
  }, {});

  // FIXME: remove hard-coded version number
  const metadataFetchRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
    Object.values(PayloadItems).flatMap((metadataType) =>
      metadataType
        .filter((item) => !item.metadataRetrieve)
        .map(
          (item): CompositeRequestBody => ({
            method: 'GET',
            url: `/services/data/v49.0/tooling/sobjects/${item.type}/${item.id}?fields=Id,FullName,Metadata`,
            referenceId: item.id,
          })
        )
    ),
    25
  );

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
    response.compositeResponse.forEach((item) => {
      if (item.httpStatusCode === 200) {
        metadataItemById[item.referenceId].metadataRetrieve = item.body;
        metadataItemById[item.referenceId].metadataDeploy = { ...item.body, Id: undefined } as any; // shallow clone - nested properties will not be modified
      } else {
        metadataItemById[item.referenceId].retrieveError = item.body as any;
      }
    });
  }

  const metadataUpdateRequests: CompositeRequestBody[][] = splitArrayToMaxSize(
    Object.values(PayloadItems).flatMap((metadataType) =>
      metadataType
        .filter((item) => !!item.metadataRetrieve)
        .map(
          (item): CompositeRequestBody => {
            switch (item.type) {
              // FIXME: this requires the metadata API
              /**
                Apex triggers cannot be deactivated using Tooling API.
                You can deactivate Apex triggers using Metadata API.
                Consider using custom metadata records and include logic in your trigger to bypass trigger configuration logic.
                For more information, see the Metadata API Developer Guide.
               */

              case 'ApexTrigger': {
                item.metadataDeploy.Metadata.status = item.value ? 'Active' : 'Inactive';
                break;
              }
              case 'FlowDefinition': {
                item.metadataDeploy.Metadata.activeVersionNumber = item.activeVersion;
                break;
              }
              case 'WorkflowRule':
              case 'ValidationRule': {
                item.metadataDeploy.Metadata.active = item.value;
                break;
              }
              default:
                break;
            }

            return {
              method: 'PATCH',
              url: `/services/data/v49.0/tooling/sobjects/${item.type}/${item.id}`,
              referenceId: item.id,
              body: item.metadataDeploy,
            };
          }
        )
    ),
    25
  );

  for (const compositeRequest of metadataUpdateRequests) {
    const requestBody: CompositeRequest = {
      allOrNone: false,
      compositeRequest,
    };
    logger.log({ requestBody });
  }

  /// TODO: modify metadata based on type to prepare payload

  /// DEPLOY CHANGES - TODO:

  // validationRules.forEach((validationRule) => {
  //   requests.push({
  //     method: 'PATCH',
  //     url: `/services/data/v49.0/tooling/sobjects/ValidationRule/${validationRule.Id}`,
  //     referenceId: `ValidationRule-${validationRule.Id}`,
  //     body: { Active: validationRule.Active },
  //   });
  // });

  // workflowRules.forEach((workflowRule) => {
  //   requests.push({
  //     method: 'PATCH',
  //     url: `/services/data/v49.0/tooling/sobjects/WorkflowRule/${workflowRule.Id}`,
  //     referenceId: `WorkflowRule-${workflowRule.Id}`,
  //     body: { FullName: workflowRule.fullName, metadata: { active: workflowRule.active } },
  //   });
  // });

  // apexTriggers.forEach((apexTrigger) => {
  //   requests.push({
  //     method: 'PATCH',
  //     url: `/services/data/v49.0/tooling/sobjects/ApexTrigger/${apexTrigger.Id}`,
  //     referenceId: `ApexTrigger-${apexTrigger.Id}`,
  //     body: { Status: apexTrigger.Status },
  //   });
  // });

  // TODO: process builders

  logger.log('[REQUEST PAYLOADS]', { metadataFetchRequests, metadataUpdateRequests, metadataItemById });
}

/**
 * SOQL QUERIES
 */

export function getEntityDefinitionQuery(): string {
  const soql = composeQuery({
    fields: [
      getField(
        `(SELECT Id, Name, ApiVersion, EntityDefinitionId, Status, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM ApexTriggers WHERE ManageableState = 'unmanaged' ORDER BY NAme)`
      ),
      getField(
        `(SELECT Id, EntityDefinitionId, ValidationName, Active, Description, ErrorMessage, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM ValidationRules WHERE ManageableState = 'unmanaged' ORDER BY ValidationName)`
      ),
      getField('DeploymentStatus'),
      getField('Description'),
      getField('DetailUrl'),
      getField('DeveloperName'),
      getField('DurableId'),
      getField('EditDefinitionUrl'),
      getField('EditUrl'),
      getField('KeyPrefix'),
      getField('Label'),
      getField('FORMAT(LastModifiedDate)'),
      getField('MasterLabel'),
      getField('NewUrl'),
      getField('PluralLabel'),
      getField('PublisherId'),
      getField('QualifiedApiName'),
      getField('LastModifiedById'),
    ],
    sObject: 'EntityDefinition',
    where: {
      left: {
        field: 'IsCustomSetting',
        operator: '=',
        value: 'FALSE',
        literalType: 'BOOLEAN',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'IsDeprecatedAndHidden',
          operator: '=',
          value: 'FALSE',
          literalType: 'BOOLEAN',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'IsEverCreatable',
            operator: '=',
            value: 'TRUE',
            literalType: 'BOOLEAN',
          },
          operator: 'AND',
          right: {
            left: {
              field: 'IsWorkflowEnabled',
              operator: '=',
              value: 'TRUE',
              literalType: 'BOOLEAN',
            },
            operator: 'AND',
            right: {
              left: {
                field: 'IsQueryable',
                operator: '=',
                value: 'TRUE',
                literalType: 'BOOLEAN',
              },
            },
          },
        },
      },
    },
    orderBy: {
      field: 'QualifiedApiName',
      order: 'ASC',
    },
  });
  logger.info('getEntityDefinitionQuery()', { soql });
  return soql;
}

export function getWorkflowRuleQuery(sobject: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('TableEnumOrId'),
      getField('FORMAT(CreatedDate)'),
      getField('CreatedBy.Name'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LastModifiedBy.Name'),
    ],
    sObject: 'WorkflowRule',
    where: {
      left: {
        field: 'TableEnumOrId',
        operator: '=',
        value: sobject,
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'ManageableState',
          operator: '=',
          value: 'unmanaged',
          literalType: 'STRING',
        },
      },
    },
    orderBy: {
      field: 'Name',
    },
  });
  logger.info('getWorkflowRuleQuery()', { soql });
  return soql;
}

export function getFlowDependencyQuery(durableId: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('RefMetadataComponentId'),
      getField('RefMetadataComponentType'),
      getField('RefMetadataComponentName'),
      getField('MetadataComponentId'),
      getField('MetadataComponentType'),
      getField('MetadataComponentName'),
      getField('MetadataComponentNamespace'), // is flow managed?
    ],
    sObject: 'MetadataComponentDependency',
    where: {
      left: {
        field: 'MetadataComponentType',
        operator: '=',
        value: 'Flow',
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'RefMetadataComponentType',
          operator: '=',
          value: 'CustomObject',
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            openParen: 1,
            field: 'RefMetadataComponentId',
            operator: '=',
            value: durableId,
            literalType: 'STRING',
          },
          operator: 'OR',
          // Custom objects use the sobject api name as the durable id
          right: {
            left: {
              closeParen: 1,
              field: 'RefMetadataComponentName',
              operator: '=',
              value: durableId,
              literalType: 'STRING',
            },
          },
        },
      },
    },
  });
  logger.info('getFlowDependencyQuery()', { soql });
  return soql;
}

export function getFlowsQuery(flowDefinitionIds: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Description'),
      getField('DeveloperName'),
      getField('MasterLabel'),
      getField('ActiveVersionId'),
      getField('ActiveVersion.VersionNumber'),
      getField('LatestVersionId'),
      getField('LatestVersion.VersionNumber'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LastModifiedBy.Name'),
      getField('FORMAT(CreatedDate)'),
      getField('CreatedBy.Name'),
      getField(
        '(SELECT Id, Description, MasterLabel, DefinitionId, ProcessType, Status, VersionNumber, FORMAT(LastModifiedDate), LastModifiedBy.Name, FORMAT(CreatedDate), CreatedBy.Name FROM Versions ORDER BY VersionNumber DESC)'
      ),
    ],
    sObject: 'FlowDefinition',
    where: {
      left: {
        field: 'Id',
        operator: 'IN',
        value: flowDefinitionIds,
        literalType: 'STRING',
      },
    },
    orderBy: {
      field: 'DeveloperName',
    },
  });
  logger.info('getFlowsQuery()', { soql });
  return soql;
}

export function getLatestFlowDefinitionIds() {
  const soql = composeQuery({
    fields: [
      {
        type: 'FieldFunctionExpression',
        functionName: 'MAX',
        parameters: ['Id'],
        isAggregateFn: true,
        rawValue: 'MAX(Id)',
        alias: 'MostRecentId',
      },
      getField('DefinitionId'),
    ],
    sObject: 'Flow',
    where: {
      left: {
        field: 'ProcessType',
        operator: 'IN',
        value: ["'Workflow'", "'InvocableProcess'"],
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'ManageableState',
          operator: '=',
          value: 'unmanaged',
          literalType: 'STRING',
        },
      },
    },
    groupBy: {
      field: ['ProcessType', 'DefinitionId'],
    },
  });
  logger.info('getLatestFlowDefinitionIds()', { soql });
  return soql;
}
