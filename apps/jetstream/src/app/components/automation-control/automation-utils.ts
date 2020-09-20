// LAME

import { composeQuery, getField } from 'soql-parser-js';
import { genericRequest, query, readMetadata } from '@jetstream/shared/data';
import { MapOf, SalesforceOrgUi, CompositeRequest, CompositeRequestBody, CompositeResponse } from '@jetstream/types';
import {
  ToolingFlowRecord,
  ToolingFlowRecordWithDefinition,
  MetadataWorkflowRuleRecord,
  ToolingWorkflowRuleRecord,
  ToolingWorkflowRuleRecordWithMetadata,
  ToolingMetadataComponentDependencyRecord,
  ToolingFlowDefinitionWithVersions,
  AutomationControlMetadataTypeItem,
  ToolingValidationRuleRecord,
  ToolingAssignmentRuleRecord,
  ToolingApexTriggerRecord,
  AutomationControlParentSobject,
  ToolingEntityDefinitionRecord,
  FlowMetadata,
  ToolingFlowAggregateRecord,
} from './automation-control-types';
import { ensureBoolean, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { logger } from '@jetstream/shared/client-logger';

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
          items: sobject.ValidationRules
            ? convertValidationRuleRecordsToAutomationControlItem(sobject.QualifiedApiName, sobject.ValidationRules.records)
            : [],
        },
        WorkflowRule: {
          metadataType: 'WorkflowRule',
          loading: false,
          hasLoaded: false,
          items: [],
        },
        Flow: {
          metadataType: 'Flow',
          loading: false,
          hasLoaded: false,
          items: [],
        },
        ApexTrigger: {
          metadataType: 'ApexTrigger',
          loading: false,
          hasLoaded: true,
          items: sobject.ApexTriggers ? convertApexTriggerRecordsToAutomationControlItem(sobject.ApexTriggers.records) : [],
        },
        AssignmentRule: {
          metadataType: 'AssignmentRule',
          loading: false,
          hasLoaded: true,
          items: sobject.AssignmentRules
            ? convertAssignmentRuleRecordsToAutomationControlItem(sobject.QualifiedApiName, sobject.AssignmentRules.records)
            : [],
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

export function convertAssignmentRuleRecordsToAutomationControlItem(
  sobjectName: string,
  records: ToolingAssignmentRuleRecord[]
): AutomationControlMetadataTypeItem<ToolingAssignmentRuleRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingAssignmentRuleRecord> => ({
      fullName: encodeURIComponent(`${sobjectName}.${record.Name}`),
      label: record.Name,
      description: '',
      currentValue: record.Active,
      initialValue: record.Active,
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
 * This uses the dependency API to figure out the dependent flows
 * Then fetches the relevant flows
 * @param selectedOrg
 * @param entityDefinitionId
 */
export async function getProcessBuilders(selectedOrg: SalesforceOrgUi, durableId: string): Promise<ToolingFlowDefinitionWithVersions[]> {
  const flowDependencyOnSobjectResults = await query<ToolingMetadataComponentDependencyRecord>(
    selectedOrg,
    getFlowDependencyQuery(durableId),
    true
  );

  const flowVersionIds = flowDependencyOnSobjectResults.queryResults.records.map((record) => record.MetadataComponentId);
  if (flowVersionIds.length > 0) {
    const flowResults = await query<ToolingFlowRecordWithDefinition>(selectedOrg, getFlowsQuery(flowVersionIds), true);

    if (flowResults.queryResults.totalSize > 0) {
      const flowDefinitionsById = flowResults.queryResults.records.reduce(
        (flowDefinitionsById: MapOf<ToolingFlowDefinitionWithVersions>, record) => {
          flowDefinitionsById[record.DefinitionId] = flowDefinitionsById[record.DefinitionId] || { ...record.Definition, Versions: [] };
          flowDefinitionsById[record.DefinitionId].Versions.push({ ...record, Definition: undefined } as ToolingFlowRecord);
          return flowDefinitionsById;
        },
        {}
      );

      return Object.values(flowDefinitionsById);
    }
  }

  return [];
}

export async function getProcessBuildersNew(
  selectedOrg: SalesforceOrgUi,
  sobject: string,
  flowVersionsBySobject: MapOf<string[]> | null
): Promise<{
  flowVersionsBySobject: MapOf<string[]>;
  flows: ToolingFlowDefinitionWithVersions[];
}> {
  /**
   * If we do not have a cached response already, then get all metadata
   */
  if (!flowVersionsBySobject) {
    flowVersionsBySobject = flowVersionsBySobject || {};
    const flowDependencyOnSobjectResults = await query<ToolingFlowAggregateRecord>(selectedOrg, getLatestFlowDefinitionIds(), true);
    const recordSets = splitArrayToMaxSize(flowDependencyOnSobjectResults.queryResults.records, 25);

    /**
     * Composite request allows up to 25 records to be processed at once
     * Using a for loop to allow async/await - serially process results and combine them into flowVersionsBySobject
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
      flowVersionsBySobject = response.compositeResponse.reduce((output: MapOf<string[]>, record) => {
        const [sobject] = record.body.Metadata.processMetadataValues
          .filter((value) => value.name === 'ObjectType')
          .map((value) => value.value.stringValue);
        if (sobject) {
          output[sobject] = output[sobject] || [];
          output[sobject].push(record.body.Id);
        }
        return output;
      }, flowVersionsBySobject);
    }
  }

  const flowVersionIds = flowVersionsBySobject[sobject];
  // re-query everything that we need and combine into the correct data structure
  if (flowVersionIds && flowVersionIds.length > 0) {
    const flowResults = await query<ToolingFlowRecordWithDefinition>(selectedOrg, getFlowsQuery(flowVersionIds), true);

    if (flowResults.queryResults.totalSize > 0) {
      const flowDefinitionsById = flowResults.queryResults.records.reduce(
        (flowDefinitionsById: MapOf<ToolingFlowDefinitionWithVersions>, record) => {
          flowDefinitionsById[record.DefinitionId] = flowDefinitionsById[record.DefinitionId] || { ...record.Definition, Versions: [] };
          flowDefinitionsById[record.DefinitionId].Versions.push({ ...record, Definition: undefined } as ToolingFlowRecord);
          return flowDefinitionsById;
        },
        {}
      );

      return { flows: Object.values(flowDefinitionsById), flowVersionsBySobject };
    }
  }

  // There are no flow versions for the selected SObject
  return { flows: [], flowVersionsBySobject };
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
        `(SELECT Id, EntityDefinitionId, Name, Active, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM AssignmentRules ORDER BY Name)`
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

export function getFlowsQuery(flowVersionIds: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Description'),
      getField('MasterLabel'),
      getField('DefinitionId'),
      getField('ProcessType'),
      getField('Status'),
      getField('VersionNumber'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LastModifiedBy.Name'),
      getField('FORMAT(CreatedDate)'),
      getField('CreatedBy.Name'),
      getField('Definition.Id'),
      getField('Definition.Description'),
      getField('Definition.DeveloperName'),
      getField('Definition.MasterLabel'),
      getField('Definition.ActiveVersionId'),
      getField('Definition.ActiveVersion.VersionNumber'),
      getField('Definition.LatestVersionId'),
      getField('Definition.LatestVersion.VersionNumber'),
      getField('FORMAT(Definition.LastModifiedDate)'),
      getField('Definition.LastModifiedBy.Name'),
      getField('FORMAT(Definition.CreatedDate)'),
      getField('Definition.CreatedBy.Name'),
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
          field: 'Id',
          operator: 'IN',
          value: flowVersionIds,
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
    },
    orderBy: [
      {
        field: 'Definition.DeveloperName',
        order: 'ASC',
      },
      {
        field: 'VersionNumber',
        order: 'DESC',
      },
    ],
  });
  logger.info('getWorkflowRuleQuery()', { soql });
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
      {
        type: 'Field',
        field: 'DefinitionId',
      },
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
