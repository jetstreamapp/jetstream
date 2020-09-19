/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi, UiTabSection } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Spinner,
  Tabs,
} from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import {
  AutomationControlMetadataType,
  AutomationControlMetadataTypeItem,
  AutomationControlParentSobject,
  AutomationMetadataType,
  ToolingEntityDefinitionRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingFlowRecord,
} from './automation-control-types';
import * as fromAutomationCtlState from './automation-control.state';
import {
  convertApexTriggerRecordsToAutomationControlItem,
  convertAssignmentRuleRecordsToAutomationControlItem,
  convertFlowRecordsToAutomationControlItem,
  convertValidationRuleRecordsToAutomationControlItem,
  convertWorkflowRuleRecordsToAutomationControlItem,
  getEntityDefinitionQuery,
  getProcessBuilders,
  getWorkflowRulesMetadata,
} from './automation-utils';
import { AutomationControlTabContent } from './content/Content';
import { AutomationControlTabTitle } from './AutomationControlTitle';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControl3Props {}

export const AutomationControl3: FunctionComponent<AutomationControl3Props> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  // TODO: reset when org changes
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);

  const [itemIds, setItemIds] = useState<string[]>([]);
  const [itemsById, setItemsById] = useState<MapOf<AutomationControlParentSobject>>({});
  const [activeItemId, setActiveItemId] = useState<string>(null);
  const [tabs, setTabs] = useState<UiTabSection[]>([]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          // TODO: adjust where clause to ensure we are getting correct sobjects
          const entityDefinitions = await query<ToolingEntityDefinitionRecord>(selectedOrg, getEntityDefinitionQuery(), true);
          setSobjects(orderObjectsBy(entityDefinitions.queryResults.records, 'MasterLabel'));
        } catch (ex) {
          logger.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, setSobjects]);

  useEffect(() => {
    if (sobjects) {
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
      setItemIds(itemIdsTemp);
      setItemsById(itemsByIdTemp);
    }
  }, [sobjects]);

  useEffect(() => {
    setTabs(
      itemIds
        .map((itemId) => itemsById[itemId])
        .map(
          (item): UiTabSection => ({
            id: item.key,
            title: <AutomationControlTabTitle item={item} isActive={item.key === activeItemId} />,
            titleText: item.sobjectLabel,
            content: (
              <AutomationControlTabContent
                item={item}
                onChange={(type, value, childItem, grandChildItem) => handleItemChange(item.key, type, value, childItem, grandChildItem)}
                toggleAll={(value) => handleToggleAll(item.key, value)}
              />
            ),
          })
        )
    );
  }, [itemIds, itemsById]);

  function handleItemChange(
    parentItemKey: string,
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) {
    const itemsByIdTemp = { ...itemsById, [parentItemKey]: { ...itemsById[parentItemKey] } };
    // This seems complicated because typescript is being stupid because of our generic types :sob:
    // This just changed to checkbox for currentItem = value
    itemsByIdTemp[parentItemKey].automationItems[type as any] = { ...itemsByIdTemp[parentItemKey].automationItems[type] };
    if (type !== 'Flow') {
      const currItem: AutomationControlMetadataType = itemsByIdTemp[parentItemKey].automationItems[type as any];
      currItem.items = currItem.items.map((childItem) =>
        childItem.fullName === item.fullName ? { ...item, currentValue: value } : childItem
      );
    } else {
      // For process builders, we need to set the parent item based on the child items
      // and only one items can be active at a time
      const currItem: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions, ToolingFlowRecord> =
        itemsByIdTemp[parentItemKey].automationItems[type as any];

      currItem.items = currItem.items.map((childItem) => {
        // see if FlowDefinition matches the current childItem
        if (childItem.fullName !== item.fullName || !Array.isArray(childItem.children)) {
          return childItem;
        }
        // Match - process flow versions
        childItem = { ...childItem };
        // If false, set every flow version to false including flow definition
        if (!value) {
          childItem.currentValue = false;
          childItem.children = childItem.children.map((currGrandChildItem) => ({ ...currGrandChildItem, currentValue: false }));
        } else {
          // If value is true, set parent to true, all other items to false, and current item to true
          childItem.currentValue = value;
          childItem.children = childItem.children.map((currGrandChildItem) =>
            currGrandChildItem.fullName === grandChildItem.fullName
              ? { ...currGrandChildItem, currentValue: true }
              : { ...currGrandChildItem, currentValue: false }
          );
        }
        return childItem;
      });
    }

    setItemsById(itemsByIdTemp);
  }

  function handleToggleAll(parentItemKey: string, value: boolean | null) {
    // clone items that will be modified
    const itemsByIdTemp = {
      ...itemsById,
      [parentItemKey]: { ...itemsById[parentItemKey], automationItems: { ...itemsById[parentItemKey].automationItems } },
    };
    Object.values(itemsByIdTemp[parentItemKey].automationItems).forEach((automationItem: AutomationControlMetadataType) => {
      automationItem.items = automationItem.items.map((item) => {
        if (value === null) {
          return { ...item, currentValue: item.initialValue };
        }
        return { ...item, currentValue: !!value };
      });
    });
    setItemsById(itemsByIdTemp);
  }

  async function handleActiveTabIdChange(tabId: string) {
    const itemsByIdTemp = { ...itemsById };
    itemsByIdTemp[tabId] = { ...itemsById[tabId] };
    const currTab = itemsById[tabId];

    setActiveItemId(tabId);

    if (!currTab.hasLoaded && !currTab.loading) {
      // Indicate that we are loading
      currTab.loading = true;
      const needToLoad = {
        WorkflowRule: false,
        Flow: false,
      };

      if (!currTab.automationItems.WorkflowRule.hasLoaded && !currTab.automationItems.WorkflowRule.loading) {
        currTab.automationItems.WorkflowRule = { ...currTab.automationItems.WorkflowRule, loading: true };
        needToLoad.WorkflowRule = true;
      }

      if (!currTab.automationItems.Flow.hasLoaded && !currTab.automationItems.Flow.loading) {
        currTab.automationItems.Flow = { ...currTab.automationItems.Flow, loading: true };
        needToLoad.Flow = true;
      }

      // set loading indicator
      setItemsById(itemsByIdTemp);

      // Fetch and load metadata
      if (needToLoad.WorkflowRule) {
        loadWorkflowRules(tabId);
      }
      if (needToLoad.Flow) {
        loadProcessBuilders(tabId);
      }
    }
  }

  async function loadWorkflowRules(tabId: string) {
    const itemsByIdTemp = { ...itemsById };
    itemsByIdTemp[tabId] = { ...itemsById[tabId] };
    const currTab = itemsById[tabId];

    const workflowRules = await getWorkflowRulesMetadata(selectedOrg, currTab.sobjectName);

    currTab.automationItems.WorkflowRule = {
      ...currTab.automationItems.WorkflowRule,
      loading: false,
      hasLoaded: true,
      items: convertWorkflowRuleRecordsToAutomationControlItem(workflowRules),
    };

    setItemsById(itemsByIdTemp);
  }

  async function loadProcessBuilders(tabId: string) {
    const itemsByIdTemp = { ...itemsById };
    itemsByIdTemp[tabId] = { ...itemsById[tabId] };
    const currTab = itemsById[tabId];

    const flows = await getProcessBuilders(selectedOrg, currTab.entityDefinitionRecord.DurableId);

    currTab.automationItems.Flow = {
      ...currTab.automationItems.WorkflowRule,
      loading: false,
      hasLoaded: true,
      items: convertFlowRecordsToAutomationControlItem(flows),
    };

    setItemsById(itemsByIdTemp);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className="slds-button slds-button_brand">
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
              Deploy Changes
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {sobjects && sobjects.length > 0 && (
          <Tabs
            position="vertical"
            tabs={tabs}
            // TODO: we probably need to calculate this because the % does not work across all screen sizes
            ulStyle={{
              maxHeight: '86vh',
              overflowY: 'scroll',
            }}
            onChange={handleActiveTabIdChange}
          />
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default AutomationControl3;
