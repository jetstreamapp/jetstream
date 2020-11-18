/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { QueryFieldWithPolymorphic } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tabs,
} from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectUserPreferenceState } from '../../../app-state';
// import QueryWorker from '../../../workers/query.worker';
import * as fromQueryState from '../query.state';
import QueryHistory from '../QueryHistory/QueryHistory';
import QueryFilterTitleSummary from '../QueryOptions/accordion-titles/QueryFilterTitleSummary';
import QueryLimitTitleSummary from '../QueryOptions/accordion-titles/QueryLimitTitleSummary';
import QueryOrderByTitleSummary from '../QueryOptions/accordion-titles/QueryOrderByTitleSummary';
import QueryFilter from '../QueryOptions/QueryFilter';
import QueryLimit from '../QueryOptions/QueryLimit';
import QueryOrderBy from '../QueryOptions/QueryOrderBy';
import QueryResetButton from '../QueryOptions/QueryResetButton';
import SoqlTextarea from '../QueryOptions/SoqlTextarea';
import QueryWalkthrough from '../QueryWalkthrough/QueryWalkthrough';
import { calculateSoqlQueryFilter } from '../utils/query-utils';
import QueryBuilderSoqlUpdater from './QueryBuilderSoqlUpdater';
import QueryFieldsComponent from './QueryFields';
import QuerySObjects from './QuerySObjects';
import QuerySubquerySObjects from './QuerySubquerySObjects';

const HEIGHT_BUFFER = 170;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryBuilderProps {}

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = () => {
  const match = useRouteMatch();

  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const queryFieldsMap = useRecoilValue(fromQueryState.queryFieldsMapState);
  const childRelationships = useRecoilValue(fromQueryState.queryChildRelationships);

  const [selectedFields, setSelectedFields] = useRecoilState(fromQueryState.selectedQueryFieldsState);
  const [selectedSubqueryFieldsState, setSelectedSubqueryFieldsState] = useRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const [filterFields, setFilterFields] = useRecoilState(fromQueryState.filterQueryFieldsState);
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);
  const [isFavorite, setIsFavorite] = useRecoilState(fromQueryState.queryIsFavoriteState);
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
  const [userPreferences, setUserPreferences] = useRecoilState(selectUserPreferenceState);

  // FIXME: this is a hack and should not be here
  const [showRightHandPane, setShowRightHandPane] = useState(!!selectedSObject);
  const [priorSelectedSObject, setPriorSelectedSObject] = useState(selectedSObject);
  const [showWalkthrough, setShowWalkthrough] = useState(!userPreferences.skipQueryWalkthrough);

  // const [queryWorker] = useState(() => new QueryWorker());

  // stupid hack to force query filters to re-render :sob:
  useEffect(() => {
    let timer1;
    if (priorSelectedSObject && selectedSObject && selectedSObject.name !== priorSelectedSObject.name) {
      setShowRightHandPane(false);
      timer1 = setTimeout(() => {
        setShowRightHandPane(true);
      }, 0);
    } else if (!showRightHandPane) {
      setShowRightHandPane(true);
    }
    return () => {
      if (timer1) {
        clearTimeout(timer1);
      }
    };
  }, [selectedSObject]);

  useEffect(() => {
    if (queryFieldsMap && selectedSObject) {
      // using worker:
      // queryWorker.postMessage({
      // name: 'calculateFilter',
      // data: queryFieldsMap,
      // });
      setFilterFields(calculateSoqlQueryFilter(queryFieldsMap));
    } else {
      setFilterFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, queryFieldsMap, selectedFields]);

  useEffect(() => {
    if (!priorSelectedSObject && selectedSObject) {
      setPriorSelectedSObject(selectedSObject);
    } else if (selectedSObject && selectedSObject.name !== priorSelectedSObject.name) {
      setPriorSelectedSObject(selectedSObject);
      resetQueryFieldsMapState();
      resetQueryFieldsKey();
      resetSelectedSubqueryFieldsState();
      resetQueryFiltersState();
      resetQueryOrderByState();
      resetQueryLimit();
      resetQueryLimitSkip();
      resetQuerySoqlState();
      resetQueryChildRelationships();
      resetQueryIncludeDeletedRecordsState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject]);

  // useEffect(() => {
  //   if (queryWorker) {
  //     queryWorker.onmessage = (event: MessageEvent) => {
  //       const payload: WorkerMessage<'calculateFilter', ListItemGroup[]> = event.data;
  //       logger.log({ payload });
  //       switch (payload.name) {
  //         case 'calculateFilter': {
  //           setFilterFields(payload.data);
  //           break;
  //         }
  //         default:
  //           break;
  //       }
  //     };
  //   }
  // }, [queryWorker, setFilterFields]);

  function handleSubquerySelectedField(relationshipName: string, fields: QueryFieldWithPolymorphic[]) {
    const tempSelectedSubqueryFieldsState = { ...selectedSubqueryFieldsState, [relationshipName]: fields };
    setSelectedSubqueryFieldsState(tempSelectedSubqueryFieldsState);
  }

  function handleQueryWalkthroughClose(skipInFuture: boolean) {
    setShowWalkthrough(false);
    setUserPreferences({ ...userPreferences, skipQueryWalkthrough: skipInFuture });
  }

  return (
    <Fragment>
      <QueryBuilderSoqlUpdater />
      {showWalkthrough && <QueryWalkthrough onClose={handleQueryWalkthroughClose} />}
      <Page>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle icon={{ type: 'standard', icon: 'entity' }} label="Query Records" />
            <PageHeaderActions colType="actions" buttonType="separate">
              <button className="slds-button slds-button_neutral" title="Open help walkthrough" onClick={() => setShowWalkthrough(true)}>
                <Icon type="utility" icon="help" description="Open help walkthrough" className="slds-button__icon slds-button__icon_left" />
                Help
              </button>
              <QueryResetButton />
              {/* <button className={classNames('slds-button slds-button_neutral')} aria-haspopup="true" title="Favorites">
                <Icon type="utility" icon="favorite" className="slds-button__icon slds-button__icon_left" omitContainer />
                View Favorites
              </button> */}
              <QueryHistory />
              {soql && selectedSObject && (
                <Link
                  className="slds-button slds-button_brand"
                  to={{
                    pathname: `${match.url}/results`,
                    state: {
                      soql,
                      sobject: {
                        label: selectedSObject.label,
                        name: selectedSObject.name,
                      },
                    },
                  }}
                >
                  <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
                  Execute
                </Link>
              )}
              {!soql && (
                <button className="slds-button slds-button_brand" disabled>
                  <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
                  Execute
                </button>
              )}
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
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
              {/* <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2> */}
              <QuerySObjects />
            </div>
            <div className="slds-p-horizontal_x-small">
              {selectedSObject && (
                <Tabs
                  key={selectedSObject.name}
                  initialActiveId="BaseFields"
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
                          onSelectionChanged={setSelectedFields}
                        />
                      ),
                    }, // record
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
                          <QuerySubquerySObjects childRelationships={childRelationships} onSelectionChanged={handleSubquerySelectedField} />
                        </AutoFullHeightContainer>
                      ),
                    },
                  ]}
                />
              )}
            </div>
            <div className="slds-p-horizontal_x-small">
              <AutoFullHeightContainer fillHeight bufferIfNotRendered={HEIGHT_BUFFER}>
                {selectedSObject && showRightHandPane && (
                  <Accordion
                    initOpenIds={['filters', 'soql']}
                    sections={[
                      {
                        id: 'filters',
                        title: 'Filters',
                        titleSummaryIfCollapsed: <QueryFilterTitleSummary />,
                        content: <QueryFilter fields={filterFields} />,
                      },
                      {
                        id: 'orderBy',
                        title: 'Order By',
                        titleSummaryIfCollapsed: <QueryOrderByTitleSummary />,
                        content: <QueryOrderBy fields={filterFields} />,
                      },
                      { id: 'limit', title: 'Limit', titleSummaryIfCollapsed: <QueryLimitTitleSummary />, content: <QueryLimit /> },
                      { id: 'soql', title: 'Soql Query', content: <SoqlTextarea /> },
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
