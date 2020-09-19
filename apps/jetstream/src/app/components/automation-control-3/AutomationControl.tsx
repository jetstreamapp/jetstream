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
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { composeQuery, getField } from 'soql-parser-js';
import { selectedOrgState } from '../../app-state';
import * as fromAutomationCtlState from './automation-control.state';
import { getWorkflowRulesMetadata } from './automation-utils';
import { AutomationControlTabContent } from './AutomationControlContent';
import { AutomationControlTabTitle } from './AutomationControlTitle';
import {
  AutomationControlMetadataTypeItem,
  AutomationControlParentSobject,
  AutomationMetadataType,
  ToolingWorkflowRuleRecordWithMetadata,
  ToolingApexTriggerRecord,
  ToolingAssignmentRuleRecord,
  ToolingEntityDefinitionRecord,
  ToolingValidationRuleRecord,
} from './temp-types';

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
          const EntityDefinitionSoql =
            ` SELECT Id, ` +
            ` (SELECT Id, Name, ApiVersion, EntityDefinitionId, Status, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM ApexTriggers),` +
            ` (SELECT Id, EntityDefinitionId, Name, Active, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM AssignmentRules),` +
            ` (SELECT Id, EntityDefinitionId, ValidationName, Active, Description, ErrorMessage, FORMAT(CreatedDate), CreatedBy.Name, FORMAT(LastModifiedDate), LastModifiedBy.Name FROM ValidationRules),` +
            ` DeploymentStatus, Description,` +
            ` DetailUrl, DeveloperName, DurableId, EditDefinitionUrl, EditUrl,` +
            ` KeyPrefix, Label, FORMAT(LastModifiedDate), MasterLabel, NamespacePrefix,` +
            ` NewUrl, PluralLabel, PublisherId, QualifiedApiName, LastModifiedById` +
            ` FROM EntityDefinition` +
            ` WHERE IsCustomSetting = false` +
            ` AND IsDeprecatedAndHidden = false` +
            ` AND IsEverCreatable = true` +
            ` AND IsWorkflowEnabled = true` +
            ` AND IsQueryable = true` +
            ` ORDER BY QualifiedApiName ASC`;

          const entityDefinitions = await query<ToolingEntityDefinitionRecord>(selectedOrg, EntityDefinitionSoql, true);
          // const results = await describeGlobal(selectedOrg);
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
      // TODO: prepare some sort of data
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
              items: sobject.ValidationRules ? convertValidationRuleRecords(sobject.QualifiedApiName, sobject.ValidationRules.records) : [],
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
              items: sobject.ApexTriggers ? convertApexTriggerRecords(sobject.ApexTriggers.records) : [],
            },
            AssignmentRule: {
              metadataType: 'AssignmentRule',
              loading: false,
              hasLoaded: true,
              items: sobject.AssignmentRules ? convertAssignmentRuleRecords(sobject.QualifiedApiName, sobject.AssignmentRules.records) : [],
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
                onChange={(type, childItem, value) => handleItemChange(item.key, type, childItem, value)}
              />
            ),
          })
        )
    );
  }, [itemIds, itemsById]);

  function handleItemChange(parentItemKey: string, type: AutomationMetadataType, item: AutomationControlMetadataTypeItem, value: boolean) {
    const itemsByIdTemp = { ...itemsById, [parentItemKey]: { ...itemsById[parentItemKey] } };
    // This seems complicated because typescript is being stupid because of our generic types :sob:
    // This just changed to checkbox for currentItem = value
    itemsByIdTemp[parentItemKey].automationItems[type as any] = {
      ...itemsByIdTemp[parentItemKey].automationItems[type],
      items: (itemsByIdTemp[parentItemKey].automationItems[type].items as AutomationControlMetadataTypeItem<any>[]).map((currItem) =>
        currItem.fullName === item.fullName ? { ...item, currentValue: value } : currItem
      ),
    };
    setItemsById(itemsByIdTemp);
  }

  async function handleActiveTabIdChange(tabId: string) {
    let itemsByIdTemp = { ...itemsById };
    itemsById[tabId] = { ...itemsById[tabId] };
    let currTab = itemsById[tabId];

    // TODO: get all items that have not yet been loaded (if any)

    setActiveItemId(tabId);

    if (!currTab.hasLoaded && !currTab.loading) {
      // Indicate that we are loading
      currTab.loading = true;
      const needToLoad = {
        WorkflowRule: false,
      };

      if (!currTab.automationItems.WorkflowRule.hasLoaded && !currTab.automationItems.WorkflowRule.loading) {
        currTab.automationItems.WorkflowRule = { ...currTab.automationItems.WorkflowRule, loading: true };
        needToLoad.WorkflowRule = true;
      }
      // TODO: other types

      // set loading indicator
      setItemsById(itemsByIdTemp);

      // re-clone items
      itemsByIdTemp = { ...itemsById };
      itemsById[tabId] = { ...itemsById[tabId] };
      currTab = itemsById[tabId];

      if (needToLoad.WorkflowRule) {
        const workflowRules = await getWorkflowRulesMetadata(selectedOrg, currTab.sobjectName);
        // TODO: convert workflowRules into correct structure
        currTab.automationItems.WorkflowRule = {
          ...currTab.automationItems.WorkflowRule,
          loading: false,
          hasLoaded: true,
          items: convertWorkflowRuleRecords(currTab.sobjectName, workflowRules),
        };
      }

      setItemsById(itemsByIdTemp);
    }

    // once all are loaded, set tab as loaded
    // set all items as loading, then query, then update (may need to re-clone :sob:)
    // if (!currTab.loading && !currTab.hasLoaded) {
    //   // load-er-up

    //   const validationRuleSoql = composeQuery({
    //     fields: [
    //       getField('Id'),
    //       getField('EntityDefinitionId'),
    //       getField('ValidationName'),
    //       getField('Active'),
    //       getField('Description'),
    //       getField('ErrorMessage'),
    //       getField('CreatedDate'),
    //       getField({ field: 'Name', relationships: ['CreatedBy'] }),
    //       getField('LastModifiedDate'),
    //       getField({ field: 'Name', relationships: ['LastModifiedBy'] }),
    //     ],
    //     sObject: 'ValidationRule',
    //     where: {
    //       left: {
    //         field: 'NamespacePrefix',
    //         operator: '=',
    //         value: 'null',
    //       },
    //       operator: 'AND',
    //       right: {
    //         left: {
    //           field: 'EntityDefinitionId',
    //           operator: '=',
    //           value: currTab.entityDefinitionId,
    //           literalType: 'STRING',
    //         },
    //       },
    //     },
    //     orderBy: {
    //       field: 'ValidationName',
    //     },
    //   });
    //   const validationRules = await query<ToolingValidationRuleRecord>(selectedOrg, validationRuleSoql, true);
    //   currTab.automationItems.ValidationRule = {
    //     ...currTab.automationItems.ValidationRule,
    //     loading: false, // TODO: set first
    //     items: validationRules.queryResults.records.map(
    //       (record): AutomationControlMetadataTypeItem => ({
    //         fullName: `${record.EntityDefinitionId}.${record.ValidationName}`,
    //         label: record.ValidationName,
    //         description: record.Description,
    //         currentValue: record.Active,
    //         initialValue: record.Active,
    //         metadata: record,
    //       })
    //     ),
    //   };
    // }
  }

  function convertApexTriggerRecords(records: ToolingApexTriggerRecord[]): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord>[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem<ToolingApexTriggerRecord> => ({
        fullName: encodeURIComponent(record.Name),
        label: record.Name,
        description: '',
        currentValue: record.Status === 'Active',
        initialValue: record.Status === 'Active',
        metadata: record,
      })
    );
  }

  function convertAssignmentRuleRecords(
    sobjectName: string,
    records: ToolingAssignmentRuleRecord[]
  ): AutomationControlMetadataTypeItem<ToolingAssignmentRuleRecord>[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem<ToolingAssignmentRuleRecord> => ({
        fullName: encodeURIComponent(`${sobjectName}.${record.Name}`),
        label: record.Name,
        description: '',
        currentValue: record.Active,
        initialValue: record.Active,
        metadata: record,
      })
    );
  }

  function convertValidationRuleRecords(
    sobjectName: string,
    records: ToolingValidationRuleRecord[]
  ): AutomationControlMetadataTypeItem<ToolingValidationRuleRecord>[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem<ToolingValidationRuleRecord> => ({
        fullName: encodeURIComponent(`${sobjectName}.${record.ValidationName}`),
        label: record.ValidationName,
        description: record.Description,
        currentValue: record.Active,
        initialValue: record.Active,
        metadata: record,
      })
    );
  }

  function convertWorkflowRuleRecords(
    sobjectName: string,
    records: ToolingWorkflowRuleRecordWithMetadata[]
  ): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata>[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata> => ({
        fullName: record.metadata.fullName,
        label: record.tooling.Name,
        description: record.metadata.description,
        currentValue: record.metadata.active,
        initialValue: record.metadata.active,
        metadata: record,
      })
    );
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className={classNames('slds-button slds-button_neutral')} title="Enable All">
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              Enable All
            </button>
            <button className={classNames('slds-button slds-button_neutral')} title="Disable All">
              <Icon type="utility" icon="dash" className="slds-button__icon slds-button__icon_left" omitContainer />
              Disable All
            </button>
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
