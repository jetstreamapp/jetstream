/* eslint-disable @typescript-eslint/no-unused-vars */

import { css } from '@emotion/react';
import { IconObj } from '@jetstream/icon-factory';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { hasModifierKey, isEnterKey, useGlobalEventHandler, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  CheckboxToggle,
  ConnectedSobjectList,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tabs,
} from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromQueryState from '../query.state';
import { QueryHistoryType } from '../QueryHistory/query-history.state';
import QueryHistory, { QueryHistoryRef } from '../QueryHistory/QueryHistory';
import QueryFilterTitleSummary from '../QueryOptions/accordion-titles/QueryFilterTitleSummary';
import QueryLimitTitleSummary from '../QueryOptions/accordion-titles/QueryLimitTitleSummary';
import QueryOrderByTitleSummary from '../QueryOptions/accordion-titles/QueryOrderByTitleSummary';
import ManualSoql from '../QueryOptions/ManualSoql';
import QueryFilter from '../QueryOptions/QueryFilter';
import QueryLimit from '../QueryOptions/QueryLimit';
import QueryOrderBy from '../QueryOptions/QueryOrderBy';
import QueryResetButton from '../QueryOptions/QueryResetButton';
import SoqlTextarea from '../QueryOptions/SoqlTextarea';
import QueryWalkthrough from '../QueryWalkthrough/QueryWalkthrough';
import { calculateFilterAndOrderByListGroupFields } from '../utils/query-utils';
import ExecuteQueryButton from './ExecuteQueryButton';
import QueryBuilderSoqlUpdater from './QueryBuilderSoqlUpdater';
import QueryFieldsComponent from './QueryFields';
import QuerySubquerySObjects from './QuerySubquerySObjects';

const HEIGHT_BUFFER = 175;

const SOBJECT_QUERY_TITLE = 'Query Object Records';
const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };

const METADATA_QUERY_ID = 'metadata';
const METADATA_QUERY_TITLE = 'Query Metadata Records';
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryBuilderProps {}

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = () => {
  const isMounted = useRef(null);
  const { trackEvent } = useAmplitude();
  const match = useRouteMatch();
  const history = useHistory();
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const queryHistoryRef = useRef<QueryHistoryRef>();

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const queryFieldsMap = useRecoilValue(fromQueryState.queryFieldsMapState);
  const childRelationships = useRecoilValue(fromQueryState.queryChildRelationships);
  const isRestore = useRecoilValue(fromQueryState.isRestore);
  const soql = useRecoilValue(fromQueryState.querySoqlState);

  const [sobjects, setSobjects] = useRecoilState(fromQueryState.sObjectsState);
  const [sObjectFilterTerm, setSObjectFilterTerm] = useRecoilState(fromQueryState.sObjectFilterTerm);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromQueryState.selectedSObjectState);
  const [isTooling, setIsTooling] = useRecoilState(fromQueryState.isTooling);
  const [selectedFields, setSelectedFields] = useRecoilState(fromQueryState.selectedQueryFieldsState);
  const [selectedSubqueryFieldsState, setSelectedSubqueryFieldsState] = useRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const [filterFields, setFilterFields] = useRecoilState(fromQueryState.filterQueryFieldsState);
  const [orderByFields, setOrderByFields] = useRecoilState(fromQueryState.orderByQueryFieldsState);

  const resetSelectedQueryFieldsState = useResetRecoilState(fromQueryState.selectedQueryFieldsState);
  const resetFilterQueryFieldsState = useResetRecoilState(fromQueryState.filterQueryFieldsState);
  const resetOrderByQueryFieldsState = useResetRecoilState(fromQueryState.orderByQueryFieldsState);
  const resetSelectedSObject = useResetRecoilState(fromQueryState.selectedSObjectState);
  const resetSObjectFilterTerm = useResetRecoilState(fromQueryState.sObjectFilterTerm);
  const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);
  const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetRecoilState(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const resetQueryChildRelationships = useResetRecoilState(fromQueryState.queryChildRelationships);
  const resetQueryIncludeDeletedRecordsState = useResetRecoilState(fromQueryState.queryIncludeDeletedRecordsState);

  const [pageTitle, setPageTitle] = useState(isTooling ? METADATA_QUERY_TITLE : SOBJECT_QUERY_TITLE);

  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (selectedSObject && soql && hasModifierKey(event as any) && isEnterKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        history.push(`${match.url}/results`, {
          soql,
          isTooling,
          sobject: {
            label: selectedSObject.label,
            name: selectedSObject.name,
          },
        });
      }
    },
    [history, isTooling, match.url, selectedSObject, soql]
  );

  useGlobalEventHandler('keydown', onKeydown);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    if (showWalkthrough) {
      trackEvent(ANALYTICS_KEYS.query_HelpClicked, { isTooling });
    }
  }, [isTooling, showWalkthrough, trackEvent]);

  useNonInitialEffect(() => {
    if (queryFieldsMap && selectedSObject) {
      setFilterFields(calculateFilterAndOrderByListGroupFields(queryFieldsMap, ['filterable']));
      setOrderByFields(calculateFilterAndOrderByListGroupFields(queryFieldsMap, ['sortable']));
    } else if (!isRestore) {
      // if restore is true, then avoid reset will page is being re-hydrated
      setFilterFields([]);
      setOrderByFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, queryFieldsMap, selectedFields]);

  function handleSubquerySelectedField(relationshipName: string, fields: QueryFieldWithPolymorphic[]) {
    const tempSelectedSubqueryFieldsState = { ...selectedSubqueryFieldsState, [relationshipName]: fields };
    setSelectedSubqueryFieldsState(tempSelectedSubqueryFieldsState);
  }

  function handleQueryWalkthroughClose() {
    setShowWalkthrough(false);
  }

  function handleSobjectsChange(sobjects: DescribeGlobalSObjectResult[]) {
    setSobjects(sobjects);
    if (!sobjects) {
      resetState();
    }
  }

  function handleSelectedSObject(sobject: DescribeGlobalSObjectResult) {
    if (sobject?.name !== selectedSObject?.name) {
      resetState(false);
      setSelectedSObject(sobject);
    }
  }

  function handleQueryTypeChange(id: string) {
    setIsTooling(id === METADATA_QUERY_ID);
    trackEvent(ANALYTICS_KEYS.query_MetadataQueryToggled, { changedTo: id });
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
      resetQueryFiltersState();
      resetQueryOrderByState();
      resetQueryLimit();
      resetQueryLimitSkip();
      resetQuerySoqlState();
      resetQueryChildRelationships();
      resetQueryIncludeDeletedRecordsState();
    },
    [
      resetFilterQueryFieldsState,
      resetOrderByQueryFieldsState,
      resetQueryChildRelationships,
      resetQueryFieldsKey,
      resetQueryFieldsMapState,
      resetQueryFiltersState,
      resetQueryIncludeDeletedRecordsState,
      resetQueryLimit,
      resetQueryLimitSkip,
      resetQueryOrderByState,
      resetQuerySoqlState,
      resetSelectedQueryFieldsState,
      resetSelectedSObject,
      resetSObjectFilterTerm,
      resetSelectedSubqueryFieldsState,
    ]
  );

  useNonInitialEffect(() => {
    setPageTitle(isTooling ? METADATA_QUERY_TITLE : SOBJECT_QUERY_TITLE);
    resetState();
  }, [isTooling, resetState]);

  function handleOpenHistory(type: QueryHistoryType) {
    queryHistoryRef.current?.open(type);
  }

  return (
    <Fragment>
      <QueryBuilderSoqlUpdater />
      {showWalkthrough && <QueryWalkthrough onClose={handleQueryWalkthroughClose} />}
      <Page>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={isTooling ? METADATA_QUERY_ICON : SOBJECT_QUERY_ICON}
              labelHeading={isTooling ? 'Metadata' : 'Objects'}
              // label={pageTitle}
              label="Query Records"
              docsPath="/query"
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
              <button className="slds-button slds-button_neutral" title="Open help walkthrough" onClick={() => setShowWalkthrough(true)}>
                <Icon type="utility" icon="help" description="Open help walkthrough" className="slds-button__icon slds-button__icon_left" />
                Help
              </button>
              <QueryResetButton />
              <ManualSoql isTooling={isTooling} generatedSoql={soql} />
              <QueryHistory selectedOrg={selectedOrg} ref={queryHistoryRef} />
              <ExecuteQueryButton soql={soql} isTooling={isTooling} selectedSObject={selectedSObject} />
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
            <div className="slds-p-horizontal_x-small" data-testid="sobject-list">
              <ConnectedSobjectList
                label={isTooling ? 'Metadata' : 'Objects'}
                selectedOrg={selectedOrg}
                sobjects={sobjects}
                selectedSObject={selectedSObject}
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
                {selectedSObject && isMounted.current && (
                  <Accordion
                    key={selectedSObject.name}
                    initOpenIds={['filters', 'soql']}
                    sections={[
                      {
                        id: 'filters',
                        title: 'Filters',
                        titleSummaryIfCollapsed: <QueryFilterTitleSummary key={selectedSObject.name} />,
                        content: <QueryFilter key={selectedSObject.name} fields={filterFields} />,
                      },
                      {
                        id: 'orderBy',
                        title: 'Order By',
                        titleSummaryIfCollapsed: <QueryOrderByTitleSummary key={selectedSObject.name} />,
                        content: <QueryOrderBy key={selectedSObject.name} fields={orderByFields} />,
                      },
                      {
                        id: 'limit',
                        title: 'Limit',
                        titleSummaryIfCollapsed: <QueryLimitTitleSummary key={selectedSObject.name} />,
                        content: <QueryLimit key={selectedSObject.name} />,
                      },
                      {
                        id: 'soql',
                        title: 'Soql Query',
                        content: (
                          <SoqlTextarea
                            key={selectedSObject.name}
                            soql={soql}
                            selectedOrg={selectedOrg}
                            selectedSObject={selectedSObject}
                            isTooling={isTooling}
                            onOpenHistory={handleOpenHistory}
                          />
                        ),
                      },
                    ]}
                    allowMultiple
                  ></Accordion>
                )}
              </AutoFullHeightContainer>
            </div>
          </Split>
        </AutoFullHeightContainer>
      </Page>
    </Fragment>
  );
};

export default QueryBuilder;
