/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Accordion } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import AutomationControlContentApexTrigger from './content/ApexTrigger';
import AutomationControlContentAssignmentRule from './content/AssignmentRule';
import { AutomationControlContentValidationRule } from './content/ValidationRule';
import AutomationControlContentWorkflowRule from './content/WorkflowRule';
import { AutomationControlMetadataTypeItem, AutomationControlParentSobject, AutomationMetadataType } from './temp-types';

interface AutomationControlTabContentProps {
  item: AutomationControlParentSobject;
  onChange: (type: AutomationMetadataType, item: AutomationControlMetadataTypeItem, value: boolean) => void;
}

function getModifiedItemsText(items: AutomationControlMetadataTypeItem[]) {
  const modifiedItemCount = items.filter((item) => item.currentValue !== item.initialValue).length;
  if (modifiedItemCount) {
    return ` (${modifiedItemCount} Modified)`;
  } else {
    return '';
  }
}

export const AutomationControlTabContent: FunctionComponent<AutomationControlTabContentProps> = ({ item, onChange }) => {
  return (
    <div>
      <h3 className="slds-text-heading_medium">{item.sobjectLabel}</h3>
      <Accordion
        initOpenIds={['ValidationRule', 'WorkflowRule', 'Flow', 'ApexTrigger', 'AssignmentRule']}
        showExpandCollapseAll
        sections={[
          {
            id: 'ValidationRule',
            title: `Validation Rules ${getModifiedItemsText(item.automationItems.ValidationRule.items)}`,
            content: <AutomationControlContentValidationRule items={item.automationItems.ValidationRule.items} onChange={onChange} />,
          },
          {
            id: 'WorkflowRule',
            title: `Workflow Rules ${getModifiedItemsText(item.automationItems.WorkflowRule.items)}`,
            content: (
              <AutomationControlContentWorkflowRule
                items={item.automationItems.WorkflowRule.items}
                loading={item.automationItems.WorkflowRule.loading}
                onChange={onChange}
              />
            ),
          },
          {
            id: 'Flow',
            title: `Process Builders`,
            content: (
              <span>
                this is proving VERY challenging... we might want to scrap this for v1. It is easy to set an active version, but it is very
                difficult to figure out the sobject that process builder belongs to. requires obtaining all full metadata for every process
                builder in the system and then parsing the response to figure this out. And we still have to deal with versions here, so
                more data to keep track of for reactivation. If we could show all the process builders in the org instead of by object, then
                it would not be a big deal.
              </span>
            ),
          },

          {
            id: `ApexTrigger`,
            title: `Apex Triggers ${getModifiedItemsText(item.automationItems.ApexTrigger.items)}`,
            content: <AutomationControlContentApexTrigger items={item.automationItems.ApexTrigger.items} onChange={onChange} />,
          },
          {
            id: 'AssignmentRule',
            title: `Assignment Rules ${getModifiedItemsText(item.automationItems.AssignmentRule.items)}`,
            content: <AutomationControlContentAssignmentRule items={item.automationItems.AssignmentRule.items} onChange={onChange} />,
          },
        ]}
        allowMultiple={true}
      ></Accordion>
    </div>
  );
};
