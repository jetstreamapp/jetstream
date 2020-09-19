// LAME

import { composeQuery, getField } from 'soql-parser-js';
import { query, readMetadata } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { FlowRecord, MetadataWorkflowRuleRecord, ToolingWorkflowRuleRecord, ToolingWorkflowRuleRecordWithMetadata } from './temp-types';
import { ensureBoolean } from '@jetstream/shared/utils';

export async function getWorkflowRulesMetadata(selectedOrg: SalesforceOrgUi, sobject: string) {
  const workflowRuleSoql = composeQuery({
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
    },
    orderBy: {
      field: 'Name',
    },
  });

  const workflowRules = await query<ToolingWorkflowRuleRecord>(selectedOrg, workflowRuleSoql, true);

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

// WE HAVE TO GET EVERYTHING IN THE ORG (SLOW!!!!) TO KNOW WHAT OBJECTS THEY APPLY TO :SOB:
export async function getProcessBuildersAndFlows(selectedOrg: SalesforceOrgUi, sobject: string) {
  const flowSoql = composeQuery({
    fields: [
      getField('Id'),
      getField('DeveloperName'),
      getField('MasterLabel'),
      getField('Description'),
      getField('ActiveVersionId'),
      getField('LatestVersionId'),
      getField('FORMAT(CreatedDate)'),
      getField('CreatedBy.Name'),
      getField('FORMAT(LastModifiedDate)'),
      getField('LastModifiedBy.Name'),
    ],
    sObject: 'WorkflowRule',
    where: {
      left: {
        field: 'ManageableState',
        operator: '=',
        value: 'Unmanaged',
        literalType: 'STRING',
      },
    },
    orderBy: {
      field: 'DeveloperName',
    },
  });

  // TODO: add type
  const flows = await query<FlowRecord>(selectedOrg, flowSoql, true);

  // if (flows.queryResults.totalSize > 0) {
  //   const flowsByFullName = flows.queryResults.records.reduce((output, item) => {
  //     output[item.DeveloperName] = item;
  //     return output;
  //   }, {});

  //   // NOTE: FlowDefinition is really easy to set active flow version
  //   // https://help.salesforce.com/articleView?id=000338777&type=1&mode=1
  //   // the issue is we do not know which PB belong to which object :sob:
  //   // Maybe process builders need to be managed some other way
  //   // TODO:
  //   /**
  //    * Figure out what flows are process builders --> <processType>Workflow | InvocableProcess</processType>
  //    * --- "Don't edit the metadata of retrieved Process Builder processes (Flow components whose processType is Workflow or InvocableProcess.) If you deploy process metadata that you've edited, you might not be able to open the process in the target org."
  //    * Figure out what object they each belong to
  //    * store all of them globally for future use (not just for this one sobject)
  //    *
  //    * I think I have to loop through <processMetadataValues> and find
  //    * TriggerType => not sure if I need this (onAllChanges)
  //    * ObjectType => sobject
  //    */

  //   const flowsWithToolingAndMetadata = (
  //     await readMetadata<MetadataWorkflowRuleRecord>(
  //       selectedOrg,
  //       'WorkflowRule',
  //       flows.queryResults.records.map((workflowRule) => `${workflowRule.TableEnumOrId}.${workflowRule.Name}`)
  //     )
  //   ).map(
  //     (item): ToolingWorkflowRuleRecordWithMetadata => {
  //       item.active = ensureBoolean(item.active);
  //       return {
  //         tooling: flowsByFullName[item.fullName],
  //         metadata: item,
  //       };
  //     }
  //   );

  //   return flowsWithToolingAndMetadata;
  // }
  return [];
}

// SELECT Id,
//   CreatedById,
//   CreatedDate,
//   Description,
//   DeveloperName,
//   MasterLabel,
//   ActiveVersionId,
//   ActiveVersion.CreatedDate,
//   ActiveVersion.MasterLabel,
//   ActiveVersion.LastModifiedDate,
//   ActiveVersion.ProcessType,
//   ActiveVersion.Status,
//   ActiveVersion.VersionNumber,
//   ActiveVersion.LastModifiedBy.Id,
//   ActiveVersion.LastModifiedBy.Name,
//   ActiveVersion.CreatedBy.Name,
//   LatestVersionId,
//   LatestVersion.CreatedDate,
//   LatestVersion.MasterLabel,
//   LatestVersion.LastModifiedDate,
//   LatestVersion.ProcessType,
//   LatestVersion.Status,
//   LatestVersion.VersionNumber,
//   LatestVersion.LastModifiedBy.Id,
//   LatestVersion.LastModifiedBy.Name,
//   LatestVersion.CreatedBy.Name,
//   LastModifiedById,
//   LastModifiedDate,
//   NamespacePrefix
// FROM FlowDefinition
// WHERE ManageableState = 'Unmanaged'
