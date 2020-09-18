/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, query } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi, UiTabSection } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  Checkbox,
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
import { DescribeGlobalSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromAutomationCtlState from './automation-control.state';
import {
  ToolingApexTriggerRecord,
  ToolingAssignmentRuleRecord,
  ToolingEntityDefinitionRecord,
  ToolingValidationRuleRecord,
} from './temp-types';
import { composeQuery, getField } from 'soql-parser-js';
const HEIGHT_BUFFER = 170;
const SUB_ROW_PLACEHOLDER = 'SUB_ROW_PLACEHOLDER';

interface AutomationControlParentSobject {
  key: string;
  entityDefinitionId: string;
  entityDefinitionRecord: ToolingEntityDefinitionRecord;
  sobjectName: string;
  sobjectLabel: string;
  loading: boolean;
  hasLoaded: boolean;
  inProgress: boolean;
  error: boolean;
  automationItems: {
    ValidationRule: AutomationControlMetadataType;
    WorkflowRule: AutomationControlMetadataType;
    Flow: AutomationControlMetadataType;
    ApexTrigger: AutomationControlMetadataType;
    AssignmentRule: AutomationControlMetadataType;
  };
}

interface AutomationControlMetadataType<T = unknown> {
  metadataType: string;
  loading: boolean;
  hasLoaded: boolean;
  items: AutomationControlMetadataTypeItem<T>[];
}

interface AutomationControlMetadataTypeItem<T = unknown> {
  fullName: string;
  label: string;
  description: string;
  isDirty: boolean;
  initialValue: boolean;
  currentValue: boolean;
  metadata: T;
}

interface AutomationControlTabTitleProps {
  item: AutomationControlParentSobject;
  isActive: boolean; // TODO: do I need this?
}
export const AutomationControlTabTitle: FunctionComponent<AutomationControlTabTitleProps> = ({ item, isActive }) => {
  return (
    <Fragment>
      <span className="slds-vertical-tabs__left-icon"></span>
      <span className="slds-truncate" title={item.sobjectLabel}>
        {item.sobjectLabel}
      </span>
      <span className="slds-vertical-tabs__right-icon">
        {/* TODO: loading / status / etc.. */}
        {/* <Icon
        type="standard"
        icon="opportunity"
        containerClassname="lds-icon_container slds-icon-standard-opportunity"
        className="slds-icon slds-icon_small"
      /> */}
      </span>
    </Fragment>
  );
};

interface AutomationControlTabContentProps {
  item: AutomationControlParentSobject;
  isActive: boolean; // TODO: do I need this?
}
export const AutomationControlTabContent: FunctionComponent<AutomationControlTabContentProps> = ({ item, isActive }) => {
  return (
    <div>
      <h3 className="slds-text-heading_medium">{item.sobjectLabel}</h3>
      <Accordion
        initOpenIds={[]}
        sections={[
          {
            id: 'ValidationRule',
            title: 'Validation Rules',
            content: (
              <span>
                {item.automationItems.ValidationRule.hasLoaded &&
                  (item.automationItems.ValidationRule.items.length > 0 ? (
                    <ul>
                      {item.automationItems.ValidationRule.items.map((item) => (
                        <li key={item.fullName} className="slds-m-left_small">
                          {item.label} {item.description}
                          <Checkbox id={`ValidationRule-${item.fullName}`} label="Is Active" readOnly checked={item.currentValue} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'No items to display'
                  ))}
              </span>
            ),
          },
          { id: 'WorkflowRule', title: 'Workflow Rules', content: <span>TODO:</span> },
          { id: 'Flow', title: 'Process Builders', content: <span>TODO:</span> },
          {
            id: 'ApexTrigger',
            title: 'Apex Triggers',
            content: (
              <span>
                {item.automationItems.ApexTrigger.hasLoaded &&
                  (item.automationItems.ApexTrigger.items.length > 0 ? (
                    <ul>
                      {item.automationItems.ApexTrigger.items.map((item) => (
                        <li key={item.fullName} className="slds-m-left_small">
                          {item.label} {item.description}
                          <Checkbox id={`ApexTrigger-${item.fullName}`} label="Is Active" readOnly checked={item.currentValue} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'No items to display'
                  ))}
              </span>
            ),
          },
          {
            id: 'AssignmentRule',
            title: 'Assignment Rules',
            content: (
              <span>
                {item.automationItems.AssignmentRule.hasLoaded &&
                  (item.automationItems.AssignmentRule.items.length > 0 ? (
                    <ul>
                      {item.automationItems.AssignmentRule.items.map((item) => (
                        <li key={item.fullName} className="slds-m-left_small">
                          {item.label} {item.description}
                          <Checkbox id={`AssignmentRule-${item.fullName}`} label="Is Active" readOnly checked={item.currentValue} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'No items to display'
                  ))}
              </span>
            ),
          },
        ]}
        allowMultiple={true}
      ></Accordion>
    </div>
  );
};

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
            ` (SELECT Id, Name, ApiVersion, EntityDefinitionId, Status, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexTriggers),` +
            ` (SELECT Id, EntityDefinitionId, Name, Active, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM AssignmentRules),` +
            ` (SELECT Id, EntityDefinitionId, ValidationName, Active, Description, ErrorMessage, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ValidationRules),` +
            ` DeploymentStatus, Description,` +
            ` DetailUrl, DeveloperName, DurableId, EditDefinitionUrl, EditUrl,` +
            ` KeyPrefix, Label, LastModifiedDate, MasterLabel, NamespacePrefix,` +
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
      const tabIdsTemp: string[] = [];
      const tabsByIdTemp = sobjects.reduce((output: MapOf<AutomationControlParentSobject>, sobject) => {
        tabIdsTemp.push(sobject.QualifiedApiName);
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
      setItemIds(tabIdsTemp);
      setItemsById(tabsByIdTemp);
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
            content: <AutomationControlTabContent item={item} isActive={item.key === activeItemId} />,
          })
        )
    );
  }, [itemIds, itemsById]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo') && !sobject.name.endsWith('share') && !sobject.name.endsWith('history');
  }

  async function handleActiveTabIdChange(tabId: string) {
    const itemsByIdTemp = { ...itemsById };
    itemsById[tabId] = { ...itemsById[tabId] };
    const currTab = itemsById[tabId];

    // TODO: get all items that have not yet been loaded (if any)
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
    //         isDirty: false,
    //         metadata: record,
    //       })
    //     ),
    //   };
    // }

    setActiveItemId(tabId);
    setItemsById(itemsByIdTemp);
  }

  function convertApexTriggerRecords(records: ToolingApexTriggerRecord[]): AutomationControlMetadataTypeItem[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem => ({
        fullName: encodeURIComponent(record.Name),
        label: record.Name,
        description: '',
        currentValue: record.Status === 'Active',
        initialValue: record.Status === 'Active',
        isDirty: false,
        metadata: record,
      })
    );
  }

  function convertAssignmentRuleRecords(sobjectName: string, records: ToolingAssignmentRuleRecord[]): AutomationControlMetadataTypeItem[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem => ({
        fullName: encodeURIComponent(`${sobjectName}.${record.Name}`),
        label: record.Name,
        description: '',
        currentValue: record.Active,
        initialValue: record.Active,
        isDirty: false,
        metadata: record,
      })
    );
  }

  function convertValidationRuleRecords(sobjectName: string, records: ToolingValidationRuleRecord[]): AutomationControlMetadataTypeItem[] {
    return records.map(
      (record): AutomationControlMetadataTypeItem => ({
        fullName: encodeURIComponent(`${sobjectName}.${record.ValidationName}`),
        label: record.ValidationName,
        description: record.Description,
        currentValue: record.Active,
        initialValue: record.Active,
        isDirty: false,
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
