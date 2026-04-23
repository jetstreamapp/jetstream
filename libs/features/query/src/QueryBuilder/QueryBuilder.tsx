/* eslint-disable @typescript-eslint/no-unused-vars */
import { css } from '@emotion/react';
import { IconObj } from '@jetstream/icon-factory';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  getFlattenedListItemsById,
  getListItemsFromFieldWithRelatedItems,
  hasModifierKey,
  isEnterKey,
  sortQueryFields,
  unFlattenedListItemsById,
  useGlobalEventHandler,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, Field, ListItem, QueryFieldWithPolymorphic, SoqlQueryFormatOptions } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  CheckboxToggle,
  ConnectedSobjectList,
  Grid,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tabs,
} from '@jetstream/ui';
import {
  fromJetstreamEvents,
  fromQueryHistoryState,
  fromQueryState,
  QueryHistory,
  QueryHistoryRef,
  useAmplitude,
} from '@jetstream/ui-core';
import { applicationCookieState, selectedOrgState, soqlQueryFormatOptionsState } from '@jetstream/ui/app-state';
import { formatQuery } from '@jetstreamapp/soql-parser-js';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ManualSoql from '../QueryOptions/ManualSoql';
import QueryBuilderAdvancedOptions from '../QueryOptions/QueryBuilderAdvancedOptions';
import QueryCount from '../QueryOptions/QueryCount';
import QueryFilter from '../QueryOptions/QueryFilter';
import QueryLimit from '../QueryOptions/QueryLimit';
import QueryOrderBy from '../QueryOptions/QueryOrderBy';
import QueryResetButton from '../QueryOptions/QueryResetButton';
import SoqlTextarea from '../QueryOptions/SoqlTextarea';
import QueryFilterTitleSummary from '../QueryOptions/accordion-titles/QueryFilterTitleSummary';
import QueryLimitTitleSummary from '../QueryOptions/accordion-titles/QueryLimitTitleSummary';
import QueryOrderByTitleSummary from '../QueryOptions/accordion-titles/QueryOrderByTitleSummary';
import TabTitleActivityIndicator from '../QueryOptions/accordion-titles/TabTitleActivityIndicator';
import QueryWalkthrough from '../QueryWalkthrough/QueryWalkthrough';
import ExecuteQueryButton from './ExecuteQueryButton';
import QueryBuilderSoqlUpdater from './QueryBuilderSoqlUpdater';
import QueryFieldsComponent from './QueryFields';
import QuerySubqueryConfigPanel from './QuerySubqueryConfigPanel';
import QuerySubquerySObjects from './QuerySubquerySObjects';

const HEIGHT_BUFFER = 175;

const SOBJECT_QUERY_TITLE = 'Query Object Records';
const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };

const METADATA_QUERY_ID = 'metadata';
const METADATA_QUERY_TITLE = 'Query Metadata Records';
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

// Tiny atom-connected wrappers so order-by / limit subscriptions stay leaf-scoped —
// a change to queryOrderByState / queryLimit re-renders the wrapper, not the whole QueryBuilder body.
interface ConnectedQueryOrderByProps {
  sobject: string;
  fields: ListItem[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

const ConnectedQueryOrderBy: FunctionComponent<ConnectedQueryOrderByProps> = ({ sobject, fields, onLoadRelatedFields }) => {
  const [orderByClauses, setOrderByClauses] = useAtom(fromQueryState.queryOrderByState);
  return (
    <QueryOrderBy
      sobject={sobject}
      fields={fields}
      orderByClauses={orderByClauses}
      setOrderByClauses={setOrderByClauses}
      onLoadRelatedFields={onLoadRelatedFields}
    />
  );
};

const ConnectedQueryLimit: FunctionComponent = () => {
  const [limit, setLimit] = useAtom(fromQueryState.queryLimit);
  const [limitSkip, setLimitSkip] = useAtom(fromQueryState.queryLimitSkip);
  const hasLimitOverride = useAtomValue(fromQueryState.selectQueryLimitHasOverride);
  return (
    <QueryLimit limit={limit} setLimit={setLimit} limitSkip={limitSkip} setLimitSkip={setLimitSkip} hasLimitOverride={hasLimitOverride} />
  );
};

export const QueryBuilder = () => {
  const { trackEvent } = useAmplitude();
  const navigate = useNavigate();
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const queryHistoryRef = useRef<QueryHistoryRef>(null);

  const selectedOrg = useAtomValue(selectedOrgState);
  const childRelationships = useAtomValue(fromQueryState.queryChildRelationships);
  const [soql, setSoql] = useAtom(fromQueryState.querySoqlState);
  const [soqlQueryFormatOptions, setSoqlQueryFormatOptions] = useAtom(soqlQueryFormatOptionsState);

  const [sobjects, setSobjects] = useAtom(fromQueryState.sObjectsState);
  const [sObjectFilterTerm, setSObjectFilterTerm] = useAtom(fromQueryState.sObjectFilterTerm);
  const [selectedSObject, setSelectedSObject] = useAtom(fromQueryState.selectedSObjectState);
  const [isTooling, setIsTooling] = useAtom(fromQueryState.isTooling);
  const [selectedFields, setSelectedFields] = useAtom(fromQueryState.selectedQueryFieldsState);
  const [selectedSubqueryFieldsState, setSelectedSubqueryFieldsState] = useAtom(fromQueryState.selectedSubqueryFieldsState);
  const [filterFields, setFilterFields] = useAtom(fromQueryState.filterQueryFieldsState);
  const [orderByFields, setOrderByFields] = useAtom(fromQueryState.orderByQueryFieldsState);
  const setGroupByFields = useSetAtom(fromQueryState.groupByQueryFieldsState);
  const queryKey = useAtomValue(fromQueryState.selectQueryKeyState);
  const [queryFilters, setQueryFilters] = useAtom(fromQueryState.queryFiltersState);
  const subqueryConfigPanel = useAtomValue(fromQueryState.subqueryConfigPanelState);
  const resetSubqueryConfigPanel = useResetAtom(fromQueryState.subqueryConfigPanelState);

  const resetSelectedQueryFieldsState = useResetAtom(fromQueryState.selectedQueryFieldsState);
  const resetFilterQueryFieldsState = useResetAtom(fromQueryState.filterQueryFieldsState);
  const resetOrderByQueryFieldsState = useResetAtom(fromQueryState.orderByQueryFieldsState);
  const resetSelectedSObject = useResetAtom(fromQueryState.selectedSObjectState);
  const resetSObjectFilterTerm = useResetAtom(fromQueryState.sObjectFilterTerm);
  const resetQueryFieldsMapState = useResetAtom(fromQueryState.queryFieldsMapState);
  const resetQueryFieldsKey = useResetAtom(fromQueryState.queryFieldsKey);
  const resetSelectedSubqueryFieldsState = useResetAtom(fromQueryState.selectedSubqueryFieldsState);
  const resetQuerySubqueryFiltersState = useResetAtom(fromQueryState.querySubqueryFiltersState);
  const resetQuerySubqueryOrderByState = useResetAtom(fromQueryState.querySubqueryOrderByState);
  const resetQuerySubqueryLimitState = useResetAtom(fromQueryState.querySubqueryLimitState);
  const resetQueryFiltersState = useResetAtom(fromQueryState.queryFiltersState);
  const resetQueryHavingState = useResetAtom(fromQueryState.queryHavingState);
  const resetFieldFilterFunctions = useResetAtom(fromQueryState.fieldFilterFunctions);
  const resetQueryGroupByState = useResetAtom(fromQueryState.queryGroupByState);
  const resetQueryOrderByState = useResetAtom(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetAtom(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetAtom(fromQueryState.queryLimitSkip);
  const resetQuerySoqlState = useResetAtom(fromQueryState.querySoqlState);
  const resetQueryChildRelationships = useResetAtom(fromQueryState.queryChildRelationships);
  const resetQueryIncludeDeletedRecordsState = useResetAtom(fromQueryState.queryIncludeDeletedRecordsState);

  const [, setPageTitle] = useState(isTooling ? METADATA_QUERY_TITLE : SOBJECT_QUERY_TITLE);

  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (selectedSObject && soql && hasModifierKey(event as any) && isEnterKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        navigate('results', {
          state: {
            soql,
            isTooling,
            sobject: {
              label: selectedSObject.label,
              name: selectedSObject.name,
            },
          },
        });
      }
    },
    [isTooling, navigate, selectedSObject, soql],
  );

  useGlobalEventHandler('keydown', onKeydown);

  useNonInitialEffect(() => {
    if (showWalkthrough) {
      trackEvent(ANALYTICS_KEYS.query_HelpClicked, { isTooling });
    }
  }, [isTooling, showWalkthrough, trackEvent]);

  function handleSubquerySelectedField(relationshipName: string, fields: QueryFieldWithPolymorphic[]) {
    const tempSelectedSubqueryFieldsState = { ...selectedSubqueryFieldsState, [relationshipName]: fields };
    setSelectedSubqueryFieldsState(tempSelectedSubqueryFieldsState);
  }

  function handleQueryWalkthroughClose() {
    setShowWalkthrough(false);
  }

  function handleSobjectsChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
    if (!sobjects) {
      resetState();
    }
  }

  function handleSelectedSObject(sobject: DescribeGlobalSObjectResult | null) {
    if (sobject?.name !== selectedSObject?.name) {
      resetState(false);
      setSelectedSObject(sobject);
    }
  }

  function handleSaveSoqlQueryFormatOptions(options: SoqlQueryFormatOptions): void {
    setSoqlQueryFormatOptions(options);
    try {
      setSoql(formatQuery(soql, options));
    } catch {
      // Ignore formatting errors for invalid SOQL
    }
    fromJetstreamEvents.emit({ type: 'saveSoqlQueryFormatOptions', payload: { value: options } });
  }

  /**
   * Load ListItem for drill-in fields in filter and OrderBy
   */
  async function loadRelatedFilterAndOrderbyFields(item: ListItem): Promise<ListItem[]> {
    try {
      const field = item.meta as Field;
      if (!Array.isArray(field.referenceTo) || field.referenceTo.length <= 0) {
        return [];
      }
      const { data } = await describeSObject(selectedOrg, field.referenceTo?.[0] || '');
      const allFieldMetadata = sortQueryFields(data.fields);
      const childFields = getListItemsFromFieldWithRelatedItems(allFieldMetadata, item.id);

      setFilterFields((prevItems) => {
        let allFilterItems = getFlattenedListItemsById(prevItems);
        allFilterItems = {
          ...allFilterItems,
          [item.id]: { ...allFilterItems[item.id], childItems: childFields.filter((field) => field.meta?.filterable) },
        };
        return unFlattenedListItemsById(allFilterItems);
      });

      setOrderByFields((prevItems) => {
        let allFilterItems = getFlattenedListItemsById(prevItems);
        allFilterItems = {
          ...allFilterItems,
          [item.id]: { ...allFilterItems[item.id], childItems: childFields.filter((field) => field.meta?.sortable) },
        };
        return unFlattenedListItemsById(allFilterItems);
      });

      setGroupByFields((prevItems) => {
        let allFilterItems = getFlattenedListItemsById(prevItems);
        allFilterItems = {
          ...allFilterItems,
          [item.id]: {
            ...allFilterItems[item.id],
            childItems: childFields.filter((field) => field.meta?.groupable || field.meta?.type === 'datetime'),
          },
        };
        return unFlattenedListItemsById(allFilterItems);
      });

      return childFields;
    } catch (ex) {
      logger.warn('Error fetching related fields', ex);
    }
    return [];
  }

  const resetState = useCallback(
    (includeSobjectReset = true) => {
      if (includeSobjectReset) {
        resetSelectedSObject();
      }
      resetSObjectFilterTerm();
      resetQueryFieldsMapState();
      resetQueryFieldsKey();
      resetSelectedQueryFieldsState();
      resetFilterQueryFieldsState();
      resetOrderByQueryFieldsState();
      resetSelectedSubqueryFieldsState();
      resetQuerySubqueryFiltersState();
      resetQuerySubqueryOrderByState();
      resetQuerySubqueryLimitState();
      resetSubqueryConfigPanel();
      resetQueryFiltersState();
      resetQueryHavingState();
      resetFieldFilterFunctions();
      resetQueryGroupByState();
      resetQueryOrderByState();
      resetQueryLimit();
      resetQueryLimitSkip();
      resetQuerySoqlState();
      resetQueryChildRelationships();
      resetQueryIncludeDeletedRecordsState();
    },
    [
      resetSObjectFilterTerm,
      resetQueryFieldsMapState,
      resetQueryFieldsKey,
      resetSelectedQueryFieldsState,
      resetFilterQueryFieldsState,
      resetOrderByQueryFieldsState,
      resetSelectedSubqueryFieldsState,
      resetQuerySubqueryFiltersState,
      resetQuerySubqueryOrderByState,
      resetQuerySubqueryLimitState,
      resetSubqueryConfigPanel,
      resetQueryFiltersState,
      resetQueryHavingState,
      resetFieldFilterFunctions,
      resetQueryGroupByState,
      resetQueryOrderByState,
      resetQueryLimit,
      resetQueryLimitSkip,
      resetQuerySoqlState,
      resetQueryChildRelationships,
      resetQueryIncludeDeletedRecordsState,
      resetSelectedSObject,
    ],
  );

  useNonInitialEffect(() => {
    setPageTitle(isTooling ? METADATA_QUERY_TITLE : SOBJECT_QUERY_TITLE);
    resetState();
  }, [isTooling, resetState]);

  // The subquery config panel is ephemeral UI. Clear it on unmount so it never
  // re-opens when the user navigates away and later returns to this page.
  useEffect(() => {
    return () => {
      resetSubqueryConfigPanel();
    };
  }, [resetSubqueryConfigPanel]);

  function handleOpenHistory(type: fromQueryHistoryState.QueryHistoryType) {
    queryHistoryRef.current?.open(type);
  }

  return (
    <Fragment>
      <QueryBuilderSoqlUpdater />
      {showWalkthrough && <QueryWalkthrough onClose={handleQueryWalkthroughClose} />}
      {subqueryConfigPanel && (
        <QuerySubqueryConfigPanel
          key={subqueryConfigPanel.relationshipName}
          org={selectedOrg}
          isOpen
          relationshipName={subqueryConfigPanel.relationshipName}
          childSObject={subqueryConfigPanel.childSObject}
          onClose={resetSubqueryConfigPanel}
        />
      )}
      <Page testId="query-builder-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={isTooling ? METADATA_QUERY_ICON : SOBJECT_QUERY_ICON}
              labelHeading={isTooling ? 'Metadata' : 'Objects'}
              // label={pageTitle}
              label="Query Records"
              docsPath={APP_ROUTES.QUERY.DOCS}
              titleDropDown={
                <CheckboxToggle
                  id={`query-type-toggle`}
                  containerClassname="slds-m-left_x-small"
                  label="Query Type"
                  offText="Object Query"
                  onText="Metadata Query"
                  hideLabel
                  checked={isTooling}
                  onChange={setIsTooling}
                />
              }
            />
            <PageHeaderActions colType="actions" buttonType="separate">
              <button
                className="slds-button slds-button_neutral collapsible-button collapsible-button-lg"
                title="Open help walkthrough"
                onClick={() => setShowWalkthrough(true)}
              >
                <Icon type="utility" icon="help" description="Open help walkthrough" className="slds-button__icon slds-button__icon_left" />
                <span>Help</span>
              </button>
              <QueryResetButton />
              <ManualSoql isTooling={isTooling} generatedSoql={soql} />
              <QueryHistory selectedOrg={selectedOrg} ref={queryHistoryRef} />
              <ExecuteQueryButton selectedOrg={selectedOrg} soql={soql} isTooling={isTooling} selectedSObject={selectedSObject} />
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer
          bottomBuffer={0}
          className="slds-p-horizontal_x-small slds-scrollable_none"
          bufferIfNotRendered={HEIGHT_BUFFER}
        >
          <Split
            sizes={[17, 33, 50]}
            minSize={[200, 300, 300]}
            gutterSize={selectedSObject ? 10 : 0}
            className="slds-gutters"
            css={css`
              display: flex;
              flex-direction: row;
            `}
          >
            <div className="slds-p-horizontal_x-small">
              <ConnectedSobjectList
                label={isTooling ? 'Metadata' : 'Objects'}
                selectedOrg={selectedOrg}
                sobjects={sobjects}
                selectedSObject={selectedSObject}
                recentItemsEnabled
                recentItemsKey="sobject"
                isTooling={isTooling}
                initialSearchTerm={sObjectFilterTerm}
                onSobjects={handleSobjectsChange}
                onSelectedSObject={handleSelectedSObject}
                onSearchTermChange={setSObjectFilterTerm}
              />
            </div>
            <div className="slds-p-horizontal_x-small" data-testid="sobject-field-list">
              {selectedSObject && (
                <Tabs
                  key={selectedSObject.name}
                  initialActiveId="BaseFields"
                  contentClassname="slds-p-bottom_none"
                  tabs={[
                    {
                      id: 'BaseFields',
                      titleClassName: 'slds-size_1-of-2',
                      title: (
                        <Fragment>
                          <span className="slds-tabs__left-icon">
                            <Icon
                              type="standard"
                              icon="record"
                              containerClassname="slds-icon_container slds-icon-standard-record"
                              className="slds-icon slds-icon_small"
                            />
                          </span>
                          {selectedSObject?.name} Fields
                        </Fragment>
                      ),
                      content: (
                        <QueryFieldsComponent
                          selectedSObject={selectedSObject ? selectedSObject.name : undefined}
                          isTooling={isTooling}
                          onSelectionChanged={setSelectedFields}
                        />
                      ),
                    },
                    {
                      id: 'RelatedLists',
                      titleClassName: 'slds-size_1-of-2',
                      title: (
                        <Fragment>
                          <span className="slds-tabs__left-icon">
                            <Icon
                              type="standard"
                              icon="related_list"
                              containerClassname="slds-icon_container slds-icon-standard-related-list"
                              className="slds-icon slds-icon_small"
                            />
                          </span>
                          Related Objects (Subquery)
                        </Fragment>
                      ),
                      titleText: 'Related Objects (Subquery)',
                      content: (
                        <AutoFullHeightContainer bottomBuffer={10}>
                          <QuerySubquerySObjects
                            org={selectedOrg}
                            serverUrl={serverUrl}
                            isTooling={isTooling}
                            childRelationships={childRelationships}
                            onSelectionChanged={handleSubquerySelectedField}
                          />
                        </AutoFullHeightContainer>
                      ),
                    },
                  ]}
                />
              )}
            </div>
            <div className="slds-p-horizontal_x-small" data-testid="filters-and-soql">
              <AutoFullHeightContainer fillHeight bufferIfNotRendered={HEIGHT_BUFFER}>
                {selectedSObject && (
                  <Tabs
                    key={selectedSObject.name}
                    initialActiveId="standardOptions"
                    contentClassname="slds-p-bottom_none"
                    tabs={[
                      {
                        id: 'standardOptions',
                        titleClassName: 'slds-size_1-of-2',
                        titleText: 'Standard Options',
                        title: (
                          <Grid>
                            Standard Options
                            <TabTitleActivityIndicator type="standard" />
                          </Grid>
                        ),
                        content: (
                          <Accordion
                            key={selectedSObject.name}
                            allowMultiple
                            initOpenIds={['filters', 'soql']}
                            sections={[
                              {
                                id: 'filters',
                                title: 'Filters',
                                titleSummaryIfCollapsed: <QueryFilterTitleSummary key={queryKey} />,
                                content: (
                                  <QueryFilter
                                    key={queryKey}
                                    org={selectedOrg}
                                    sobject={selectedSObject.name}
                                    fields={filterFields}
                                    filtersOrHaving={queryFilters}
                                    setFiltersOrHaving={setQueryFilters}
                                    onLoadRelatedFields={loadRelatedFilterAndOrderbyFields}
                                  />
                                ),
                              },
                              {
                                id: 'orderBy',
                                title: 'Order By',
                                titleSummaryIfCollapsed: <QueryOrderByTitleSummary key={queryKey} />,
                                content: (
                                  <ConnectedQueryOrderBy
                                    key={queryKey}
                                    sobject={selectedSObject.name}
                                    fields={orderByFields}
                                    onLoadRelatedFields={loadRelatedFilterAndOrderbyFields}
                                  />
                                ),
                              },
                              {
                                id: 'limit',
                                title: 'Limit',
                                titleSummaryIfCollapsed: <QueryLimitTitleSummary key={queryKey} />,
                                content: <ConnectedQueryLimit key={queryKey} />,
                              },
                              {
                                id: 'soql',
                                title: (
                                  <Grid verticalAlign="end">
                                    <span className="slds-m-right_x-small">Soql Query</span>
                                    <QueryCount org={selectedOrg} />
                                  </Grid>
                                ),
                                titleText: 'SOQL Query',
                                content: (
                                  <SoqlTextarea
                                    key={selectedSObject.name}
                                    soql={soql}
                                    soqlQueryFormatOptions={soqlQueryFormatOptions}
                                    selectedOrg={selectedOrg}
                                    selectedSObject={selectedSObject}
                                    isTooling={isTooling}
                                    onOpenHistory={handleOpenHistory}
                                    onSaveSoqlQueryFormatOptions={handleSaveSoqlQueryFormatOptions}
                                  />
                                ),
                              },
                            ]}
                          ></Accordion>
                        ),
                      },
                      {
                        id: 'advancedOptions',
                        titleClassName: 'slds-size_1-of-2',
                        titleText: 'Standard Options',
                        title: (
                          <Grid>
                            Advanced Options
                            <TabTitleActivityIndicator type="advanced" />
                          </Grid>
                        ),
                        content: (
                          <QueryBuilderAdvancedOptions
                            key={queryKey}
                            org={selectedOrg}
                            sobject={selectedSObject.name}
                            selectedFields={selectedFields}
                            filterFields={filterFields}
                            initialOpenIds={['soql']}
                            onLoadRelatedFields={loadRelatedFilterAndOrderbyFields}
                            additionalSections={[
                              {
                                id: 'soql',
                                title: 'Soql Query',
                                content: (
                                  <SoqlTextarea
                                    key={selectedSObject.name}
                                    soql={soql}
                                    soqlQueryFormatOptions={soqlQueryFormatOptions}
                                    selectedOrg={selectedOrg}
                                    selectedSObject={selectedSObject}
                                    isTooling={isTooling}
                                    onOpenHistory={handleOpenHistory}
                                    onSaveSoqlQueryFormatOptions={handleSaveSoqlQueryFormatOptions}
                                  />
                                ),
                              },
                            ]}
                          />
                        ),
                      },
                    ]}
                  />
                )}
                {/* Placeholder to allow over-scrolling */}
                <div
                  aria-hidden="true"
                  css={css`
                    min-height: 100px;
                  `}
                />
              </AutoFullHeightContainer>
            </div>
          </Split>
        </AutoFullHeightContainer>
      </Page>
    </Fragment>
  );
};

export default QueryBuilder;
