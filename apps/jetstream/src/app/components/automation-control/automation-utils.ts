// LAME

import { composeQuery, getField } from 'soql-parser-js';
import { query, readMetadata } from '@jetstream/shared/data';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
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
} from './automation-control-types';
import { ensureBoolean } from '@jetstream/shared/utils';
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
