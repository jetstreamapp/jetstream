import { logger } from '@jetstream/shared/client-logger';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';

/**
 * SOQL QUERIES
 */

export function getApexTriggersQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('ApiVersion'),
      getField('EntityDefinitionId'),
      getField('EntityDefinition.QualifiedApiName'),
      getField('Status'),
      getField('CreatedBy.Id'),
      getField('CreatedBy.Name'),
      getField('CreatedBy.Username'),
      getField('FORMAT(CreatedDate)'),
      getField('LastModifiedBy.Id'),
      getField('LastModifiedBy.Name'),
      getField('LastModifiedBy.Username'),
      getField('FORMAT(LastModifiedDate)'),
    ],
    sObject: 'ApexTrigger',
    where: {
      left: {
        field: 'EntityDefinition.QualifiedApiName',
        operator: 'IN',
        value: sobjects,
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
    orderBy: [
      {
        field: 'EntityDefinitionId',
      },
      {
        field: 'Name',
      },
    ],
  });
  logger.info('getApexTriggersQuery()', { soql });
  return soql;
}

export function getDuplicateRuleQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('CreatedBy.Id'),
      getField('CreatedBy.Name'),
      getField('CreatedBy.Username'),
      getField('DeveloperName'),
      getField('IsActive'),
      getField('LastModifiedBy.Id'),
      getField('LastModifiedBy.Name'),
      getField('LastModifiedBy.Username'),
      getField('MasterLabel'),
      getField('NamespacePrefix'),
      getField('SobjectSubtype'),
      getField('SobjectType'),
      getField('FORMAT(CreatedDate)'),
      getField('FORMAT(LastModifiedDate)'),
    ],
    sObject: 'DuplicateRule',
    where: {
      left: {
        field: 'SobjectType',
        operator: 'IN',
        value: sobjects,
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'NamespacePrefix',
          operator: '=',
          value: 'NULL',
          literalType: 'NULL',
        },
      },
    },
    orderBy: [
      {
        field: 'SobjectType',
      },
      {
        field: 'MasterLabel',
      },
    ],
  });
  logger.info('getDuplicateRuleQuery()', { soql });
  return soql;
}

export function getValidationRulesQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Active'),
      getField('CreatedBy.Id'),
      getField('CreatedBy.Name'),
      getField('CreatedBy.Username'),
      getField('FORMAT(CreatedDate)'),
      getField('Description'),
      getField('EntityDefinitionId'),
      getField('EntityDefinition.QualifiedApiName'),
      getField('ErrorDisplayField'),
      getField('ErrorMessage'),
      getField('LastModifiedBy.Id'),
      getField('LastModifiedBy.Name'),
      getField('LastModifiedBy.Username'),
      getField('FORMAT(LastModifiedDate)'),
      getField('NamespacePrefix'),
      getField('ValidationName'),
    ],
    sObject: 'ValidationRule',
    where: {
      left: {
        field: 'EntityDefinition.QualifiedApiName',
        operator: 'IN',
        value: sobjects,
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
    orderBy: [
      {
        field: 'EntityDefinitionId',
      },
      {
        field: 'ValidationName',
      },
    ],
  });
  logger.info('getValidationRulesQuery()', { soql });
  return soql;
}

// TODO: there is no active flag for these without getting all metadata - WTF
export function getWorkflowRulesQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('CreatedBy.Id'),
      getField('CreatedBy.Name'),
      getField('CreatedBy.Username'),
      getField('FORMAT(CreatedDate)'),
      getField('LastModifiedBy.Id'),
      getField('LastModifiedBy.Name'),
      getField('LastModifiedBy.Username'),
      getField('FORMAT(LastModifiedDate)'),
      getField('NamespacePrefix'),
      getField('TableEnumOrId'),
    ],
    sObject: 'WorkflowRule',
    where: {
      left: {
        field: 'TableEnumOrId',
        operator: 'IN',
        value: sobjects,
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
    orderBy: [
      {
        field: 'TableEnumOrId',
      },
      {
        field: 'Name',
      },
    ],
  });
  logger.info('getWorkflowRulesQuery()', { soql });
  return soql;
}

export function getFlowsQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('ManageableState'),
      getField('IsTemplate'),
      getField('ActiveVersionId'),
      getField('Label'),
      getField('ApiName'),
      getField('Description'),
      getField('DurableId'),
      getField('IsActive'),
      getField('LastModifiedBy'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LatestVersionId'),
      getField('ProcessType'),
      getField('TriggerObjectOrEventId'),
      getField('TriggerObjectOrEvent.QualifiedApiName'),
      getField('TriggerObjectOrEventLabel'),
      getField('TriggerType'),
      // WARNING - do not add ORDER BY here as it causes versions to not get returned consistently
      getField(
        '(SELECT Id, ApiVersion, ApiVersionRuntime, DurableId, FORMAT(LastModifiedDate), ProcessType, RunInMode, Description, Label, VersionNumber, Status FROM Versions)'
      ),
    ],
    sObject: 'FlowDefinitionView',
    where: {
      left: {
        field: 'TriggerObjectOrEvent.QualifiedApiName',
        operator: 'IN',
        value: sobjects,
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'ManageableState',
          operator: 'IN',
          value: ['unmanaged', 'installed'],
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'TriggerType',
            operator: 'LIKE',
            value: 'Record%',
            literalType: 'STRING',
          },
        },
      },
    },
    orderBy: [
      {
        field: 'TriggerObjectOrEventId',
      },
      {
        field: 'Label',
      },
    ],
  });
  logger.info('getFlowQuery()', { soql });
  return soql;
}

export function getProcessBuildersQuery() {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('ActiveVersionId'),
      getField('Label'),
      getField('ApiName'),
      getField('Description'),
      getField('DurableId'),
      getField('IsActive'),
      getField('LastModifiedBy'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LatestVersionId'),
      getField('ProcessType'),
      getField('TriggerObjectOrEventId'),
      getField('TriggerObjectOrEvent.QualifiedApiName'),
      getField('TriggerObjectOrEventLabel'),
      getField('TriggerType'),
      // WARNING - do not add ORDER BY here as it causes versions to not get returned consistently
      getField(
        '(SELECT Id, ApiVersion, ApiVersionRuntime, DurableId, FORMAT(LastModifiedDate), ProcessType, RunInMode, Description, Label, VersionNumber, Status FROM Versions)'
      ),
    ],
    sObject: 'FlowDefinitionView',
    where: {
      left: {
        field: 'ProcessType',
        operator: '=',
        value: 'Workflow',
        literalType: 'STRING',
      },
    },
    orderBy: [
      {
        field: 'Label',
      },
    ],
  });
  logger.info('getProcessBuildersQuery()', { soql });
  return soql;
}
