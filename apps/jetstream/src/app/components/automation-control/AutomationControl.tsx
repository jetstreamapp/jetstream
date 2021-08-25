/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { NOOP, orderObjectsBy } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi, SalesforceOrgUiType, UiTabSection } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  FileDownloadModal,
  Grid,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
  Tabs,
  Tooltip,
} from '@jetstream/ui';
import formatRelative from 'date-fns/formatRelative';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { applicationCookieState, selectedOrgState, selectedOrgType } from '../../app-state';
import * as fromJetstreamEvents from '../core/jetstream-events';
import {
  AutomationControlMetadataType,
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  ToolingEntityDefinitionRecord,
  ToolingFlowDefinitionWithVersions,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from './automation-control-types';
import * as fromAutomationCtlState from './automation-control.state';
import { AutomationControlTabTitle } from './AutomationControlTitle';
import { AutomationControlTabContent } from './content/Content';
import AutomationControlDeployModal from './deploy/DeployModal';
import { getFlows, getValidationRulesMetadata, getWorkflowRulesMetadata } from './utils/automation-control-data-utils';
import { getEntityDefinitionQuery } from './utils/automation-control-soql-utils';
import {
  convertFlowRecordsToAutomationControlItem,
  convertValidationRuleRecordsToAutomationControlItem,
  convertWorkflowRuleRecordsToAutomationControlItem,
  initItemsById,
} from './utils/automation-control-utils';

let _lastRefreshed: string;
const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlProps {}

export const AutomationControl: FunctionComponent<AutomationControlProps> = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const isMounted = useRef(null);
  const rollbar = useRollbar();
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const orgType = useRecoilValue<SalesforceOrgUiType>(selectedOrgType);
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromAutomationCtlState.priorSelectedOrg);
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [deployModalActive, setDeployModalActive] = useState<boolean>(false);
  const [exportDataModalOpen, setExportDataModalOpen] = useState<boolean>(false);
  const [exportDataModalData, setExportDataModalData] = useState<MapOf<any[]>>({});

  const [{ serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [itemIds, setItemIds] = useRecoilState(fromAutomationCtlState.itemIds);
  const [itemsById, setItemsById] = useRecoilState(fromAutomationCtlState.itemsById);
  const [activeItemId, setActiveItemId] = useRecoilState(fromAutomationCtlState.activeItemId);
  const [tabs, setTabs] = useRecoilState(fromAutomationCtlState.tabs);
  const [flowDefinitionsBySobject, setFlowDefinitionsBySobject] = useRecoilState(fromAutomationCtlState.flowDefinitionsBySobject);
  const dirtyItems = useRecoilValue(fromAutomationCtlState.selectDirtyItems);
  const modifiedChildAutomationItems = useRecoilValue(fromAutomationCtlState.selectModifiedChildAutomationItems);
  const [filterValue, setFilterValue] = useState('');

  const resetSObjectsState = useResetRecoilState(fromAutomationCtlState.sObjectsState);
  const resetItemIds = useResetRecoilState(fromAutomationCtlState.itemIds);
  const resetItemsById = useResetRecoilState(fromAutomationCtlState.itemsById);
  const resetActiveItemId = useResetRecoilState(fromAutomationCtlState.activeItemId);
  const resetTabs = useResetRecoilState(fromAutomationCtlState.tabs);
  const resetFlowDefinitionsBySobject = useResetRecoilState(fromAutomationCtlState.flowDefinitionsBySobject);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    _lastRefreshed = lastRefreshed;
  }, [lastRefreshed]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      loadObjects().then(NOOP);
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
            title: <AutomationControlTabTitle item={item} searchTerm={filterValue} />,
            titleText: item.sobjectLabel,
            content: (
              <AutomationControlTabContent
                selectedOrg={selectedOrg}
                orgType={orgType}
                serverUrl={serverUrl}
                item={item}
                isDirty={dirtyItems.itemsById[item.key]}
                automationItemExpandChange={(metadataTypes) => handleAutomationItemExpandChanged(item.key, metadataTypes)}
                toggleChildItemExpand={(type, value, childItem) => handleToggleChildItemExpand(item.key, type, value, childItem)}
                onChange={(type, value, childItem, grandChildItem) => handleItemChange(item.key, type, value, childItem, grandChildItem)}
                toggleAll={(value) => handleToggleAll(item.key, value)}
                onExport={() => toggleExportModal(true)}
              />
            ),
          })
        )
    );
  }, [itemIds, itemsById, filterValue]);

  async function loadObjects() {
    const uniqueId = selectedOrg.uniqueId;
    setLoading(true);
    try {
      // TODO: adjust where clause to ensure we are getting correct sobjects
      const entityDefinitionsWithCache = await queryWithCache<ToolingEntityDefinitionRecord>(selectedOrg, getEntityDefinitionQuery(), true);
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
        return;
      }

      const entityDefinitions = entityDefinitionsWithCache.data;
      if (entityDefinitionsWithCache.cache) {
        const cache = entityDefinitionsWithCache.cache;
        setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
      }

      setSobjects(orderObjectsBy(entityDefinitions.queryResults.records, 'MasterLabel'));
    } catch (ex) {
      logger.error(ex);
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
        return;
      }
      setErrorMessage(ex.message);
      rollbar.error(`${ex.message}`, { stack: ex.stack, place: 'AutomationControl', type: 'Loading Data' });
    }
    setLoading(false);
  }

  function resetAfterDeploy() {
    resetSObjectsState();
    resetItemIds();
    resetItemsById();
    resetTabs();
    resetFlowDefinitionsBySobject();
  }

  function handleAutomationItemExpandChanged(parentItemKey: string, automationItems: string[]) {
    setItemsById((previousItemsById) => {
      const automationItemsSet = new Set(automationItems);
      const itemsByIdTemp = {
        ...previousItemsById,
        [parentItemKey]: { ...itemsById[parentItemKey], automationItems: { ...itemsById[parentItemKey].automationItems } },
      };

      Object.keys(itemsByIdTemp[parentItemKey].automationItems).forEach((metadataType) => {
        itemsByIdTemp[parentItemKey].automationItems[metadataType] = {
          ...itemsByIdTemp[parentItemKey].automationItems[metadataType],
          expanded: automationItemsSet.has(metadataType),
        };
      });
      return itemsByIdTemp;
    });
  }

  function handleToggleChildItemExpand(
    parentItemKey: string,
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem
  ) {
    setItemsById((previousItemsById) => {
      const itemsByIdTemp = { ...previousItemsById, [parentItemKey]: { ...previousItemsById[parentItemKey] } };
      itemsByIdTemp[parentItemKey].automationItems = {
        ...itemsByIdTemp[parentItemKey].automationItems,
        [type]: { ...itemsByIdTemp[parentItemKey].automationItems[type] },
      };
      const currItem: AutomationControlMetadataType = itemsByIdTemp[parentItemKey].automationItems[type];
      currItem.items = currItem.items.map((childItem) => (childItem.fullName === item.fullName ? { ...item, expanded: value } : childItem));
      return itemsByIdTemp;
    });
  }

  /**
   * Called when user toggles a checkbox
   * @param parentItemKey Sobject key (what tab to operate on)
   * @param type  {AutomationMetadataType} Key in automationItems
   * @param value Boolean - new value of item
   * @param item Item that was checked, or parent item that was checked for flows
   * @param grandChildItem FlowVersion that was checked - only considered if Type === 'Flow'
   */
  function handleItemChange(
    parentItemKey: string,
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) {
    setItemsById((previousItemsById) => {
      const itemsByIdTemp = { ...previousItemsById, [parentItemKey]: { ...previousItemsById[parentItemKey] } };
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
        // For flows, we need to set the parent item based on the child items
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
      return itemsByIdTemp;
    });
  }

  function handleToggleAll(parentItemKey: string, value: boolean | null) {
    setItemsById((previousItemsById) => {
      // clone items that will be modified
      const itemsByIdTemp = {
        ...previousItemsById,
        [parentItemKey]: { ...itemsById[parentItemKey], automationItems: { ...previousItemsById[parentItemKey].automationItems } },
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
      return itemsByIdTemp;
    });
  }

  /**
   * When selected object changes, load all metadata if we have not already loaded it previously
   *
   * @param tabId
   */
  function handleActiveTabIdChange(tabId: string) {
    const currTab = { ...itemsById[tabId] };

    setActiveItemId(tabId);

    if (!currTab.hasLoaded && !currTab.loading) {
      // Indicate that we are loading
      currTab.loading = true;
      const needToLoad = {
        ValidationRule: false,
        WorkflowRule: false,
        Flow: false,
      };

      if (!currTab.automationItems.ValidationRule.hasLoaded && !currTab.automationItems.ValidationRule.loading) {
        currTab.automationItems = {
          ...currTab.automationItems,
          ValidationRule: { ...currTab.automationItems.ValidationRule, loading: true },
        };
        needToLoad.ValidationRule = true;
      }

      if (!currTab.automationItems.WorkflowRule.hasLoaded && !currTab.automationItems.WorkflowRule.loading) {
        currTab.automationItems = { ...currTab.automationItems, WorkflowRule: { ...currTab.automationItems.WorkflowRule, loading: true } };
        needToLoad.WorkflowRule = true;
      }

      if (!currTab.automationItems.Flow.hasLoaded && !currTab.automationItems.Flow.loading) {
        currTab.automationItems = { ...currTab.automationItems, Flow: { ...currTab.automationItems.Flow, loading: true } };
        needToLoad.Flow = true;
      }

      // set loading indicator
      setItemsById((previousItemsById) => {
        return { ...previousItemsById, [tabId]: currTab };
      });

      if (needToLoad.ValidationRule) {
        loadValidationRules(currTab.entityDefinitionId, currTab.sobjectName, currTab.automationItems.ValidationRule)
          .then((validationRules) => {
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                ValidationRule: validationRules,
              };
              return { ...priorItems, [tabId]: currTab };
            });
          })
          .catch((err) => {
            logger.error(err);
            rollbar.error(err.message, { stack: err.stack, place: 'AutomationControl', type: 'ValidationRule' });
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                ValidationRule: {
                  ...currTab.automationItems.ValidationRule,
                  hasLoaded: true,
                  loading: false,
                  errorMessage:
                    'There was an error loading these items. If the problem persists, submit a ticket or email support@getjetstream.app for assistance.',
                },
              };
              return { ...priorItems, [tabId]: currTab };
            });
          });
      }

      // Fetch and load metadata
      if (needToLoad.WorkflowRule) {
        loadWorkflowRules(currTab.sobjectName, currTab.automationItems.WorkflowRule)
          .then((workflowRules) => {
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                WorkflowRule: workflowRules,
              };
              return { ...priorItems, [tabId]: currTab };
            });
          })
          .catch((err) => {
            logger.error(err);
            rollbar.error(err.message, { stack: err.stack, place: 'AutomationControl', type: 'WorkflowRule' });
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                WorkflowRule: {
                  ...currTab.automationItems.WorkflowRule,
                  hasLoaded: true,
                  loading: false,
                  errorMessage:
                    'There was an error loading these items. If the problem persists, submit a ticket or email support@getjetstream.app for assistance.',
                },
              };
              return { ...priorItems, [tabId]: currTab };
            });
          });
      }
      if (needToLoad.Flow) {
        loadFlows(currTab.sobjectName, currTab.automationItems.Flow)
          .then((flows) => {
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                Flow: flows,
              };
              return { ...priorItems, [tabId]: currTab };
            });
          })
          .catch((err) => {
            logger.error(err);
            rollbar.error(err.message, { stack: err.stack, place: 'AutomationControl', type: 'Flow' });
            setItemsById((priorItems) => {
              const currTab = { ...priorItems[tabId] };
              currTab.automationItems = {
                ...currTab.automationItems,
                Flow: {
                  ...currTab.automationItems.Flow,
                  hasLoaded: true,
                  loading: false,
                  errorMessage:
                    'There was an error loading these items. If the problem persists, submit a ticket or email support@getjetstream.app for assistance.',
                },
              };
              return { ...priorItems, [tabId]: currTab };
            });
          });
      }
    }
  }

  async function loadValidationRules(
    entityDefinitionId: string,
    sobjectName: string,
    currentValidationRuleMeta: AutomationControlMetadataType<ToolingValidationRuleRecord>
  ): Promise<AutomationControlMetadataType<ToolingValidationRuleRecord>> {
    const validationRules = await getValidationRulesMetadata(selectedOrg, defaultApiVersion, entityDefinitionId);
    return {
      ...currentValidationRuleMeta,
      loading: false,
      hasLoaded: true,
      items: convertValidationRuleRecordsToAutomationControlItem(sobjectName, validationRules),
    };
  }

  async function loadWorkflowRules(
    sobjectName: string,
    currentWorkflowFlowRuleMeta: AutomationControlMetadataType<ToolingWorkflowRuleRecord>
  ): Promise<AutomationControlMetadataType<ToolingWorkflowRuleRecord>> {
    const workflowRules = await getWorkflowRulesMetadata(selectedOrg, defaultApiVersion, sobjectName);
    return {
      ...currentWorkflowFlowRuleMeta,
      loading: false,
      hasLoaded: true,
      items: convertWorkflowRuleRecordsToAutomationControlItem(sobjectName, workflowRules),
    };
  }

  async function loadFlows(
    sobject: string,
    currentFlowMeta: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions>
  ): Promise<AutomationControlMetadataType<ToolingFlowDefinitionWithVersions>> {
    const response = await getFlows(selectedOrg, defaultApiVersion, sobject, flowDefinitionsBySobject);

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
  }

  function toggleExportModal(isOpen: boolean) {
    if (isOpen) {
      // prepare data
      const automationControl = itemsById[activeItemId];
      const xlsxData = {
        [`Validation Rules`]: automationControl.automationItems.ValidationRule.items.map((item) => ({
          Object: automationControl.sobjectLabel,
          Name: item.label,
          'Is Active': item.initialValue,
          'Active Version': '',
          'Last Modified By': item.LastModifiedByName,
          'Last Modified Date': item.LastModifiedDate,
        })),
        [`Workflow Rules`]: automationControl.automationItems.WorkflowRule.items.map((item) => ({
          Object: automationControl.sobjectLabel,
          Name: item.label,
          'Is Active': item.initialValue,
          'Active Version': '',
          'Last Modified By': item.LastModifiedByName,
          'Last Modified Date': item.LastModifiedDate,
        })),
        [`Process Builders & Record Flows`]: automationControl.automationItems.Flow.items.map((item) => ({
          Object: automationControl.sobjectLabel,
          Name: item.label,
          'Is Active': item.initialValue,
          'Active Version': '',
          'Last Modified By': item.LastModifiedByName,
          'Last Modified Date': item.LastModifiedDate,
        })),
        [`Apex Triggers`]: automationControl.automationItems.ApexTrigger.items.map((item) => ({
          Object: automationControl.sobjectLabel,
          Name: item.label,
          'Is Active': item.initialValue,
          'Active Version': '',
          'Last Modified By': item.LastModifiedByName,
          'Last Modified Date': item.LastModifiedDate,
        })),
      };
      setExportDataModalData(xlsxData);
    } else {
      setExportDataModalData({});
    }

    setExportDataModalOpen(isOpen);
  }

  async function handleRefresh() {
    try {
      await clearCacheForOrg(selectedOrg);
      resetSObjectsState();
      resetItemIds();
      resetItemsById();
      resetTabs();
      resetFlowDefinitionsBySobject();
      await loadObjects();
    } catch (ex) {
      // error
    }
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
        {errorMessage && (
          <div className="slds-m-around-medium">
            <ScopedNotification theme="error" className="slds-m-top_medium">
              There was a problem loading this page:
              <p>{errorMessage}</p>
            </ScopedNotification>
          </div>
        )}
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
            onFilterValueChange={setFilterValue}
            onChange={handleActiveTabIdChange}
          >
            <Grid>
              <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">Objects</h2>
              <div>
                <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed}>
                  <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
                    <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
                  </button>
                </Tooltip>
              </div>
            </Grid>
          </Tabs>
        )}
      </AutoFullHeightContainer>
      {deployModalActive && (
        <AutomationControlDeployModal
          selectedOrg={selectedOrg}
          apiVersion={defaultApiVersion}
          itemsById={modifiedChildAutomationItems}
          onClose={(refreshData?: boolean) => {
            setDeployModalActive(false);
            if (refreshData) {
              resetAfterDeploy();
            }
          }}
        />
      )}
      {exportDataModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Automation"
          modalTagline="Exported data will reflect what is in Salesforce, not unsaved changes"
          data={exportDataModalData}
          fileNameParts={['automation', itemsById[activeItemId].sobjectName]}
          allowedTypes={['xlsx']}
          onModalClose={() => toggleExportModal(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
    </Page>
  );
};

export default AutomationControl;
