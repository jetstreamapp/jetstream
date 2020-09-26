import { logger } from '@jetstream/shared/client-logger';
import { composeQuery, getField } from 'soql-parser-js';

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

export function getValidationRuleQuery(entityDefinitionId: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('EntityDefinitionId'),
      getField('ValidationName'),
      getField('Active'),
      getField('Description'),
      getField('ErrorMessage'),
      getField('FORMAT(CreatedDate)'),
      getField('CreatedBy.Name'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LastModifiedBy.Name'),
    ],
    sObject: 'ValidationRule',
    where: {
      left: {
        field: 'EntityDefinitionId',
        operator: '=',
        value: entityDefinitionId,
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
      field: 'ValidationName',
    },
  });
  logger.info('getValidationRuleQuery()', { soql });
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
