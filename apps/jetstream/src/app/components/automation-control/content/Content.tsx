/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Accordion, AutoFullHeightContainer, Grid, GridCol } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { AutomationControlMetadataTypeItem, AutomationControlParentSobject, AutomationMetadataType } from '../automation-control-types';
import AutomationControlContentApexTrigger from './ApexTrigger';
import AutomationControlContentAssignmentRule from './AssignmentRule';
import AutomationControlTabContentButtons from './ContentButtons';
import AutomationControlContentFlow from './Flow';
import { AutomationControlContentValidationRule } from './ValidationRule';
import AutomationControlContentWorkflowRule from './WorkflowRule';
interface AutomationControlTabContentProps {
  item: AutomationControlParentSobject;
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
  toggleAll: (value: boolean | null) => void;
}

function getModifiedItemsText(items: AutomationControlMetadataTypeItem[]) {
  const modifiedItemCount = items.filter((item) => item.currentValue !== item.initialValue).length;
  if (modifiedItemCount) {
    return ` (${modifiedItemCount} Modified)`;
  } else {
    return '';
  }
}

export const AutomationControlTabContent: FunctionComponent<AutomationControlTabContentProps> = ({ item, onChange, toggleAll }) => {
  return (
    <AutoFullHeightContainer bottomBuffer={30}>
      <Grid align="spread">
        <GridCol>
          <h3 className="slds-text-heading_medium">{item.sobjectLabel}</h3>
        </GridCol>
        <GridCol>
          <AutomationControlTabContentButtons item={item} toggleAll={toggleAll} />
        </GridCol>
      </Grid>
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
              <AutomationControlContentFlow
                items={item.automationItems.Flow.items}
                loading={item.automationItems.Flow.loading}
                onChange={onChange}
              />
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
    </AutoFullHeightContainer>
  );
};

export default AutomationControlTabContent;
