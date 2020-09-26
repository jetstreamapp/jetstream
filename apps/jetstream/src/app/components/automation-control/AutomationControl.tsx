/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi, UiTabSection } from '@jetstream/types';
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
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import {
  AutomationControlMetadataType,
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  ToolingEntityDefinitionRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingWorkflowRuleRecordWithMetadata,
} from './automation-control-types';
import * as fromAutomationCtlState from './automation-control.state';
import {
  convertFlowRecordsToAutomationControlItem,
  convertWorkflowRuleRecordsToAutomationControlItem,
  getEntityDefinitionQuery,
  getProcessBuilders,
  getWorkflowRulesMetadata,
  initItemsById,
} from './automation-utils';
import { AutomationControlTabTitle } from './AutomationControlTitle';
import { AutomationControlTabContent } from './content/Content';
import AutomationControlDeployModal from './deploy/DeployModal';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlProps {}

export const AutomationControl: FunctionComponent<AutomationControlProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromAutomationCtlState.priorSelectedOrg);
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [deployModalActive, setDeployModalActive] = useState<boolean>(false);

  const [itemIds, setItemIds] = useRecoilState(fromAutomationCtlState.itemIds);
  const [itemsById, setItemsById] = useRecoilState(fromAutomationCtlState.itemsById);
  const [activeItemId, setActiveItemId] = useRecoilState(fromAutomationCtlState.activeItemId);
  const [tabs, setTabs] = useRecoilState(fromAutomationCtlState.tabs);
  const [flowDefinitionsBySobject, setFlowDefinitionsBySobject] = useRecoilState(fromAutomationCtlState.flowDefinitionsBySobject);
  const dirtyItems = useRecoilValue(fromAutomationCtlState.selectDirtyItems);
  const modifiedChildAutomationItems = useRecoilValue(fromAutomationCtlState.selectModifiedChildAutomationItems);

  const resetSObjectsState = useResetRecoilState(fromAutomationCtlState.sObjectsState);
  const resetItemIds = useResetRecoilState(fromAutomationCtlState.itemIds);
  const resetItemsById = useResetRecoilState(fromAutomationCtlState.itemsById);
  const resetActiveItemId = useResetRecoilState(fromAutomationCtlState.activeItemId);
  const resetTabs = useResetRecoilState(fromAutomationCtlState.tabs);
  const resetFlowDefinitionsBySobject = useResetRecoilState(fromAutomationCtlState.flowDefinitionsBySobject);

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
    if (selectedOrg && priorSelectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      setLoading(false);
      setErrorMessage(null);
      resetSObjectsState();
      resetItemIds();
      resetItemsById();
      resetActiveItemId();
      resetTabs();
      resetFlowDefinitionsBySobject();
    } else if (!priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (!selectedOrg) {
      resetSObjectsState();
      resetItemIds();
      resetItemsById();
      resetActiveItemId();
      resetTabs();
      resetFlowDefinitionsBySobject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  useEffect(() => {
    if (sobjects && itemIds.length === 0) {
      const [itemIdsTemp, itemsByIdTemp] = initItemsById(sobjects);
      setItemIds(itemIdsTemp);
      setItemsById(itemsByIdTemp);
    }
  }, [sobjects, itemIds]);

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
                isDirty={dirtyItems.itemsById[item.key]}
                automationItemExpandChange={(metadataTypes) => handleAutomationItemExpandChanged(item.key, metadataTypes)}
                toggleChildItemExpand={(type, value, childItem) => handleToggleChildItemExpand(item.key, type, value, childItem)}
                onChange={(type, value, childItem, grandChildItem) => handleItemChange(item.key, type, value, childItem, grandChildItem)}
                toggleAll={(value) => handleToggleAll(item.key, value)}
              />
            ),
          })
        )
    );
  }, [itemIds, itemsById]);

  function resetAfterDeploy() {
    resetSObjectsState();
    resetItemIds();
    resetItemsById();
    resetTabs();
    resetFlowDefinitionsBySobject();
    // setSobjects(null);
  }

  function handleAutomationItemExpandChanged(parentItemKey: string, automationItems: string[]) {
    const automationItemsSet = new Set(automationItems);
    const itemsByIdTemp = {
      ...itemsById,
      [parentItemKey]: { ...itemsById[parentItemKey], automationItems: { ...itemsById[parentItemKey].automationItems } },
    };

    Object.keys(itemsByIdTemp[parentItemKey].automationItems).forEach((metadataType) => {
      itemsByIdTemp[parentItemKey].automationItems[metadataType] = {
        ...itemsByIdTemp[parentItemKey].automationItems[metadataType],
        expanded: automationItemsSet.has(metadataType),
      };
    });
    setItemsById(itemsByIdTemp);
  }

  function handleToggleChildItemExpand(
    parentItemKey: string,
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem
  ) {
    const itemsByIdTemp = { ...itemsById, [parentItemKey]: { ...itemsById[parentItemKey] } };
    itemsByIdTemp[parentItemKey].automationItems = {
      ...itemsByIdTemp[parentItemKey].automationItems,
      [type]: { ...itemsByIdTemp[parentItemKey].automationItems[type] },
    };
    const currItem: AutomationControlMetadataType = itemsByIdTemp[parentItemKey].automationItems[type];
    currItem.items = currItem.items.map((childItem) => (childItem.fullName === item.fullName ? { ...item, expanded: value } : childItem));
    setItemsById(itemsByIdTemp);
  }

  /**
   * Called when user toggles a checkbox
   * @param parentItemKey Sobject key (what tab to operate on)
   * @param type  {AutomationMetadataType} Key in automationItems
   * @param value Boolean - new value of item
   * @param item Item that was checked, or parent item that was checked for process builders
   * @param grandChildItem FlowVersion that was checked - only considered if Type === 'Flow'
   */
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

    itemsByIdTemp[parentItemKey].automationItems = {
      ...itemsByIdTemp[parentItemKey].automationItems,
      [type]: { ...itemsByIdTemp[parentItemKey].automationItems[type] },
    };

    if (type !== 'Flow') {
      const currItem: AutomationControlMetadataType = itemsByIdTemp[parentItemKey].automationItems[type];
      currItem.items = currItem.items.map((childItem) =>
        childItem.fullName === item.fullName ? { ...item, currentValue: value } : childItem
      );
    } else {
      // For process builders, we need to set the parent item based on the child items
      // and only one items can be active at a time
      const currItem = itemsByIdTemp[parentItemKey].automationItems[type];

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
          childItem.currentActiveVersion = null;
          childItem.children = childItem.children.map((currGrandChildItem) => ({ ...currGrandChildItem, currentValue: false }));
        } else {
          // If value is true, set parent to true, all other items to false, and current item to true
          childItem.currentValue = value;
          childItem.currentActiveVersion = null;
          childItem.children = childItem.children.map((currGrandChildItem) => {
            if (currGrandChildItem.fullName === grandChildItem.fullName) {
              childItem.currentActiveVersion = currGrandChildItem.metadata.VersionNumber;
              return { ...currGrandChildItem, currentValue: true };
            } else {
              return { ...currGrandChildItem, currentValue: false };
            }
          });
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
    Object.keys(itemsByIdTemp[parentItemKey].automationItems).forEach((key) => {
      if (key !== 'Flow') {
        itemsByIdTemp[parentItemKey].automationItems[key] = {
          ...itemsByIdTemp[parentItemKey].automationItems[key],
          items: itemsByIdTemp[parentItemKey].automationItems[key].items.map((item) => {
            if (value === null) {
              return { ...item, currentValue: item.initialValue };
            }
            return { ...item, currentValue: !!value };
          }),
        };
      } else {
        itemsByIdTemp[parentItemKey].automationItems[key] = {
          ...itemsByIdTemp[parentItemKey].automationItems[key],
          items: itemsByIdTemp[parentItemKey].automationItems[key].items.map((item) => {
            const returnItem = { ...item };
            // reset parent and grandchildren to OG value
            if (value === null) {
              returnItem.currentValue = item.initialValue;
              returnItem.currentActiveVersion = item.initialActiveVersion;
              if (Array.isArray(returnItem.children)) {
                returnItem.children = returnItem.children.map((grandChild) => ({ ...grandChild, currentValue: grandChild.initialValue }));
              }
            } else if (value) {
              // If no item selected, then select most recent version (first item in list) - otherwise ignore
              if (returnItem.children.every((grandChild) => !grandChild.currentValue)) {
                returnItem.currentValue = true;
                returnItem.currentActiveVersion = returnItem.children[0].metadata.VersionNumber;
                returnItem.children = returnItem.children.map((grandChild, i) => ({ ...grandChild, currentValue: i === 0 }));
              }
            } else {
              // If deselect all, then unselect parent and every child
              returnItem.currentValue = false;
              returnItem.currentActiveVersion = null;
              returnItem.children = returnItem.children.map((grandChild, i) => ({ ...grandChild, currentValue: false }));
            }
            return returnItem;
          }),
        };
      }
    });
    setItemsById(itemsByIdTemp);
  }

  /**
   * When selected object changes, load all metadata if we have not already loaded it previously
   *
   * @param tabId
   */
  function handleActiveTabIdChange(tabId: string) {
    let itemsByIdTemp = { ...itemsById };
    itemsByIdTemp[tabId] = { ...itemsById[tabId] };
    let currTab = itemsByIdTemp[tabId];

    setActiveItemId(tabId);

    if (!currTab.hasLoaded && !currTab.loading) {
      // Indicate that we are loading
      currTab.loading = true;
      const needToLoad = {
        WorkflowRule: false,
        Flow: false,
      };

      if (!currTab.automationItems.WorkflowRule.hasLoaded && !currTab.automationItems.WorkflowRule.loading) {
        currTab.automationItems = { ...currTab.automationItems, WorkflowRule: { ...currTab.automationItems.WorkflowRule, loading: true } };
        needToLoad.WorkflowRule = true;
      }

      if (!currTab.automationItems.Flow.hasLoaded && !currTab.automationItems.Flow.loading) {
        currTab.automationItems = { ...currTab.automationItems, Flow: { ...currTab.automationItems.Flow, loading: true } };
        needToLoad.Flow = true;
      }

      // set loading indicator
      setItemsById(itemsByIdTemp);

      // Fetch and load metadata
      if (needToLoad.WorkflowRule) {
        loadWorkflowRules(currTab.sobjectName, currTab.automationItems.WorkflowRule)
          .then((workflowRules) => {
            itemsByIdTemp = { ...itemsByIdTemp };
            itemsByIdTemp[tabId] = { ...itemsByIdTemp[tabId] };
            currTab = itemsByIdTemp[tabId];

            currTab.automationItems = {
              ...currTab.automationItems,
              WorkflowRule: workflowRules,
            };
            setItemsById(itemsByIdTemp);
          })
          .catch((err) => {
            logger.error(err);
            itemsByIdTemp = { ...itemsByIdTemp };
            itemsByIdTemp[tabId] = { ...itemsByIdTemp[tabId] };
            currTab = itemsByIdTemp[tabId];

            currTab.automationItems = {
              ...currTab.automationItems,
              WorkflowRule: {
                ...currTab.automationItems.WorkflowRule,
                hasLoaded: true,
                loading: false,
                errorMessage: 'There was an error loading these items',
              },
            };
            setItemsById(itemsByIdTemp);
          });
      }
      if (needToLoad.Flow) {
        // loadProcessBuilders(currTab.entityDefinitionRecord.DurableId, currTab.automationItems.Flow)
        loadProcessBuildersNew(currTab.sobjectName, currTab.automationItems.Flow)
          .then((flows) => {
            itemsByIdTemp = { ...itemsByIdTemp };
            itemsByIdTemp[tabId] = { ...itemsByIdTemp[tabId] };
            currTab = itemsByIdTemp[tabId];

            currTab.automationItems = {
              ...currTab.automationItems,
              Flow: flows,
            };
            setItemsById(itemsByIdTemp);
          })
          .catch((err) => {
            logger.error(err);
            itemsByIdTemp = { ...itemsByIdTemp };
            itemsByIdTemp[tabId] = { ...itemsByIdTemp[tabId] };
            currTab = itemsByIdTemp[tabId];

            currTab.automationItems = {
              ...currTab.automationItems,
              Flow: {
                ...currTab.automationItems.Flow,
                hasLoaded: true,
                loading: false,
                errorMessage: 'There was an error loading these items. If the problem persists, submit a ticket for assistance.',
              },
            };
            setItemsById(itemsByIdTemp);
          });
      }
    }
  }

  async function loadWorkflowRules(
    sobjectName: string,
    currentWorkflowFlowRuleMeta: AutomationControlMetadataType<ToolingWorkflowRuleRecordWithMetadata>
  ): Promise<AutomationControlMetadataType<ToolingWorkflowRuleRecordWithMetadata>> {
    const workflowRules = await getWorkflowRulesMetadata(selectedOrg, sobjectName);
    return {
      ...currentWorkflowFlowRuleMeta,
      loading: false,
      hasLoaded: true,
      items: convertWorkflowRuleRecordsToAutomationControlItem(sobjectName, workflowRules),
    };
  }

  async function loadProcessBuildersNew(
    sobject: string,
    currentFlowMeta: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions>
  ): Promise<AutomationControlMetadataType<ToolingFlowDefinitionWithVersions>> {
    const response = await getProcessBuilders(selectedOrg, sobject, flowDefinitionsBySobject);

    // this is only set once, so if not already set then set it. If not null, it is the same object passed in
    if (flowDefinitionsBySobject == null) {
      setFlowDefinitionsBySobject(response.flowDefinitionsBySobject);
    }

    return {
      ...currentFlowMeta,
      loading: false,
      hasLoaded: true,
      items: convertFlowRecordsToAutomationControlItem(sobject, response.flows),
    };
  }

  async function handleDeploy() {
    setDeployModalActive(true);
    // const modifiedItemsById = Object.keys(dirtyItems.itemsById)
    //   .filter((key) => dirtyItems.itemsById[key])
    //   .reduce((output: MapOf<AutomationControlParentSobject>, key) => {
    //     const currItem = itemsById[key];
    //     output[key] = itemsById[key];
    //     return output;
    //   }, {});

    // await deployChanges(selectedOrg, modifiedItemsById);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className="slds-button slds-button_brand" disabled={!dirtyItems.anyDirty} onClick={handleDeploy}>
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
              Review Changes
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {sobjects && sobjects.length > 0 && (
          <Tabs
            position="vertical"
            filterVisible
            filterPlaceholder="Filter Objects"
            tabs={tabs}
            // TODO: we probably need to calculate this because the % does not work across all screen sizes
            ulStyle={{
              maxHeight: '86vh',
              overflowY: 'scroll',
              width: '25rem',
            }}
            onChange={handleActiveTabIdChange}
          />
        )}
      </AutoFullHeightContainer>
      {deployModalActive && (
        <AutomationControlDeployModal
          selectedOrg={selectedOrg}
          itemsById={modifiedChildAutomationItems}
          onClose={(refreshData?: boolean) => {
            setDeployModalActive(false);
            if (refreshData) {
              resetAfterDeploy();
            }
          }}
        />
      )}
    </Page>
  );
};

export default AutomationControl;
