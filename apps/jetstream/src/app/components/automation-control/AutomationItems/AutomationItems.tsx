/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlItemsProps {
  selectedItems: string[];
}

export const AutomationControlItems: FunctionComponent<AutomationControlItemsProps> = ({ selectedItems }) => {
  // duplicate rule -> regular metadata
  //

  return <div></div>;
};

export default AutomationControlItems;

/**
// ValidationRule (TOOLING) - FULLNAME => {EntityDefinitionId}.{encode(ValidationName)}
// EntityDefinitionId == sobject
SELECT Id, Active, CreatedById, CreatedDate, Description,
	EntityDefinitionId, ErrorDisplayField, ErrorMessage, LastModifiedById,
	LastModifiedDate, ValidationName, LastModifiedBy.Name,
	CreatedBy.Name
FROM ValidationRule
WHERE NamespacePrefix = null

// WorkflowRule (TOOLING) - FULLNAME => {TableEnumOrId}.{encode(Name)}
// TableEnumOrId == sobject
SELECT Id, Name, CreatedById, CreatedDate, TableEnumOrId,
	LastModifiedById, LastModifiedDate, LastModifiedBy.Name, CreatedBy.Name
FROM WorkflowRule
WHERE NamespacePrefix = null

// Process Builder: (Sketchy) - FULLNAME => Definition.DeveloperName
// Query all versions, then combing by DefinitionId or something to allow user to activate/deactivate version
// TableEnumOrId == ???????? ---> this data is not available ;(
// INFORMATION https://developer.salesforce.com/docs/atlas.en-us.226.0.api_meta.meta/api_meta/meta_visual_workflow.htm
// READ: Upgrade Flow Files to API Version 44.0 or Later (not sure this applies since we are using a higher api version to access data)

// PROBLEM: NO WAY TO GET THESE BY SOBJECT :sob:

SELECT Id, CreatedDate, Description, MasterLabel, DefinitionId,
	LastModifiedDate, ProcessType, RunInMode, Status, VersionNumber,
	Definition.Id, Definition.Description, Definition.DeveloperName,
	Definition.MasterLabel, Definition.ActiveVersionId, Definition.LatestVersionId,
	LastModifiedBy.Id, LastModifiedBy.Name, CreatedBy.Id, CreatedBy.Name
FROM Flow
WHERE ManageableState = 'unmanaged'
AND Status NOT IN ('Obsolete', 'InvalidDraft')
ORDER BY Definition.DeveloperName ASC, VersionNumber ASC

SELECT Id,
  CreatedById,
  CreatedDate,
  Description,
  DeveloperName,
  MasterLabel,
  ActiveVersionId,
  ActiveVersion.CreatedDate,
  ActiveVersion.MasterLabel,
  ActiveVersion.LastModifiedDate,
  ActiveVersion.ProcessType,
  ActiveVersion.Status,
  ActiveVersion.VersionNumber,
  ActiveVersion.LastModifiedBy.Id,
  ActiveVersion.LastModifiedBy.Name,
  ActiveVersion.CreatedBy.Name,
  LatestVersionId,
  LatestVersion.CreatedDate,
  LatestVersion.MasterLabel,
  LatestVersion.LastModifiedDate,
  LatestVersion.ProcessType,
  LatestVersion.Status,
  LatestVersion.VersionNumber,
  LatestVersion.LastModifiedBy.Id,
  LatestVersion.LastModifiedBy.Name,
  LatestVersion.CreatedBy.Name,
  LastModifiedById,
  LastModifiedDate,
  NamespacePrefix
FROM FlowDefinition
WHERE ManageableState = 'Unmanaged'



// Apex Triggers - FULLNAME => Name
// TableEnumOrId == sobject
SELECT Id, Name, ApiVersion, CreatedDate, TableEnumOrId,
	EntityDefinitionId, LastModifiedDate, Status, LastModifiedBy.Id,
	LastModifiedBy.Name, CreatedBy.Id, CreatedBy.Name
FROM ApexTrigger
WHERE ManageableState = 'unmanaged'
AND Status != 'Deleted'

 */
