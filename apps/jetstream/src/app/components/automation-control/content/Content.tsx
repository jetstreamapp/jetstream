/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Accordion, AutoFullHeightContainer, Grid, GridCol } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import {
  AutomationControlMetadataType,
  AutomationControlMetadataTypeItem,
  AutomationControlParentSobject,
  AutomationMetadataType,
} from '../automation-control-types';
import AutomationControlContentApexTrigger from './ApexTrigger';
import AutomationControlTabContentButtons from './ContentButtons';
import AutomationControlContentContainer from './ContentContainer';
import AutomationControlContentFlow from './Flow';
import { AutomationControlContentValidationRule } from './ValidationRule';
import AutomationControlContentWorkflowRule from './WorkflowRule';
import classNames from 'classnames';

interface AutomationControlTabContentProps {
  item: AutomationControlParentSobject;
  isDirty: boolean;
  automationItemExpandChange: (expandedType: AutomationMetadataType[]) => void;
  toggleChildItemExpand: (type: AutomationMetadataType, value: boolean, item: AutomationControlMetadataTypeItem) => void;
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

function hasNoItems(item: AutomationControlMetadataType) {
  return !item.loading && item.items.length === 0;
}

export const AutomationControlTabContent: FunctionComponent<AutomationControlTabContentProps> = ({
  item,
  isDirty,
  automationItemExpandChange,
  toggleChildItemExpand,
  onChange,
  toggleAll,
}) => {
  const expandedAutomationItems = Object.values(item.automationItems)
    .filter((item) => item.expanded)
    .map((item) => item.metadataType);
  return (
    <AutoFullHeightContainer bottomBuffer={30}>
      <Grid align="spread">
        <GridCol>
          <h3 className="slds-text-heading_medium">{item.sobjectLabel}</h3>
        </GridCol>
        <GridCol>
          <AutomationControlTabContentButtons item={item} isDirty={isDirty} toggleAll={toggleAll} />
        </GridCol>
      </Grid>
      <Accordion
        initOpenIds={expandedAutomationItems}
        onActiveIdsChange={(openIds) => automationItemExpandChange(openIds as AutomationMetadataType[])}
        showExpandCollapseAll
        allowMultiple
        sections={[
          {
            id: 'ValidationRule',
            title: `Validation Rules ${getModifiedItemsText(item.automationItems.ValidationRule.items)}`,
            className: classNames({ 'opacity-6': hasNoItems(item.automationItems.ValidationRule) }),
            content: (
              <AutomationControlContentContainer
                parentItem={item.automationItems.ValidationRule}
                items={item.automationItems.ValidationRule.items}
              >
                <AutomationControlContentValidationRule items={item.automationItems.ValidationRule.items} onChange={onChange} />
              </AutomationControlContentContainer>
            ),
          },
          {
            id: 'WorkflowRule',
            title: `Workflow Rules ${getModifiedItemsText(item.automationItems.ValidationRule.items)}`,
            className: classNames({ 'opacity-6': hasNoItems(item.automationItems.ValidationRule) }),
            content: (
              <AutomationControlContentContainer
                parentItem={item.automationItems.WorkflowRule}
                items={item.automationItems.WorkflowRule.items}
              >
                <AutomationControlContentWorkflowRule items={item.automationItems.WorkflowRule.items} onChange={onChange} />
              </AutomationControlContentContainer>
            ),
          },
          {
            id: 'Flow',
            title: `Process Builders ${getModifiedItemsText(item.automationItems.Flow.items)}`,
            className: classNames({ 'opacity-6': hasNoItems(item.automationItems.Flow) }),
            content: (
              <AutomationControlContentContainer parentItem={item.automationItems.Flow} items={item.automationItems.Flow.items}>
                <AutomationControlContentFlow
                  items={item.automationItems.Flow.items}
                  toggleExpanded={toggleChildItemExpand}
                  onChange={onChange}
                />
              </AutomationControlContentContainer>
            ),
          },

          {
            id: `ApexTrigger`,
            title: `Apex Triggers ${getModifiedItemsText(item.automationItems.ApexTrigger.items)}`,
            className: classNames({ 'opacity-6': hasNoItems(item.automationItems.ApexTrigger) }),
            content: (
              <AutomationControlContentContainer
                parentItem={item.automationItems.ApexTrigger}
                items={item.automationItems.ApexTrigger.items}
              >
                <AutomationControlContentApexTrigger items={item.automationItems.ApexTrigger.items} onChange={onChange} />
              </AutomationControlContentContainer>
            ),
          },
        ]}
      ></Accordion>
    </AutoFullHeightContainer>
  );
};

export default AutomationControlTabContent;
