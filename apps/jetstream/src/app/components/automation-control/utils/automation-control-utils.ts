// LAME

import { MapOf } from '@jetstream/types';
import {
  AutomationControlMetadataTypeItem,
  AutomationControlParentSobject,
  ToolingApexTriggerRecord,
  ToolingEntityDefinitionRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingFlowRecord,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from '../automation-control-types';

export function initItemsById(sobjects: ToolingEntityDefinitionRecord[]): [string[], MapOf<AutomationControlParentSobject>] {
  const itemIdsTemp: string[] = [];
  const itemsByIdTemp = sobjects.reduce((output: MapOf<AutomationControlParentSobject>, sobject) => {
    itemIdsTemp.push(sobject.QualifiedApiName);
    output[sobject.QualifiedApiName] = {
      key: sobject.QualifiedApiName,
      entityDefinitionId: sobject.DurableId,
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
          hasLoaded: false,
          expanded: true,
          items: [],
          // items: sobject.ValidationRules
          //   ? convertValidationRuleRecordsToAutomationControlItem(sobject.QualifiedApiName, sobject.ValidationRules.records)
          //   : [],
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
          items: sobject.ApexTriggers
            ? convertApexTriggerRecordsToAutomationControlItem(sobject.QualifiedApiName, sobject.ApexTriggers.records)
            : [],
        },
      },
    };
    return output;
  }, {});
  return [itemIdsTemp, itemsByIdTemp];
}

export function convertApexTriggerRecordsToAutomationControlItem(
  sobjectName: string,
  records: ToolingApexTriggerRecord[]
): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord> => ({
      key: `${sobjectName}|ApexTrigger|${encodeURIComponent(record.Name)}`,
      fullName: encodeURIComponent(record.Name),
      label: record.Name,
      description: '',
      currentValue: record.Status === 'Active',
      initialValue: record.Status === 'Active',
      LastModifiedDate: record.LastModifiedDate,
      LastModifiedByName: record.LastModifiedBy?.Name,
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
      key: `${sobjectName}|ValidationRule|${sobjectName}.${record.ValidationName}`,
      fullName: record.FullName,
      label: record.ValidationName,
      description: record.Description,
      currentValue: record.Active,
      initialValue: record.Active,
      LastModifiedDate: record.LastModifiedDate,
      LastModifiedByName: record.LastModifiedBy?.Name,
      metadata: record,
    })
  );
}

export function convertWorkflowRuleRecordsToAutomationControlItem(
  sobjectName: string,
  records: ToolingWorkflowRuleRecord[]
): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord> => ({
      key: `${sobjectName}|WorkflowRule|${record.FullName}`,
      fullName: record.FullName,
      label: record.Name,
      description: record.Metadata.description,
      currentValue: record.Metadata.active,
      initialValue: record.Metadata.active,
      LastModifiedDate: record.LastModifiedDate,
      LastModifiedByName: record.LastModifiedBy?.Name,
      metadata: record,
    })
  );
}

export function convertFlowRecordsToAutomationControlItem(
  sobjectName: string,
  records: ToolingFlowDefinitionWithVersions[]
): AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>[] {
  return records.map(
    (record): AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord> => ({
      key: `${sobjectName}|Flow|${record.DeveloperName}`,
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
      LastModifiedDate: record.LastModifiedDate,
      LastModifiedByName: record.LastModifiedBy?.Name,
      children: Array.isArray(record.Versions)
        ? record.Versions.map((version) => ({
            key: `${sobjectName}|Flow|${version.Id}`,
            fullName: version.Id, // not full name in this case
            label: version.MasterLabel,
            description: version.Description,
            currentValue: version.Status === 'Active',
            initialValue: version.Status === 'Active',
            LastModifiedDate: version.LastModifiedDate,
            LastModifiedByName: version.LastModifiedBy?.Name,
            metadata: version,
          }))
        : [],
      metadata: record,
    })
  );
}
