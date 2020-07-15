/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { WorkerMessage, ListItemGroup } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import QueryWorker from '../../workers/query.worker';
import * as fromQueryState from './query.state';
import QueryBuilderSoqlUpdater from './QueryBuilderSoqlUpdater';
import QueryFieldsComponent from './QueryFields';
import QueryFilter from './QueryOptions/QueryFilter';
import QueryLimit from './QueryOptions/QueryLimit';
import QueryOrderBy from './QueryOptions/QueryOrderBy';
import SoqlTextarea from './QueryOptions/SoqlTextarea';
import QuerySObjects from './QuerySObjects';
import QueryResetButton from './QueryOptions/QueryResetButton';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryBuilderProps {}

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = () => {
  const match = useRouteMatch();

  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const queryFieldsMap = useRecoilValue(fromQueryState.queryFieldsMapState);

  const [selectedFields, setSelectedFields] = useRecoilState(fromQueryState.selectedQueryFieldsState);
  const [filterFields, setFilterFields] = useRecoilState(fromQueryState.filterQueryFieldsState);
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);
  const [isFavorite, setIsFavorite] = useRecoilState(fromQueryState.queryIsFavoriteState);
  const [showRightHandPane, setShowRightHandPane] = useState(!!selectedSObject);

  const [queryWorker] = useState(() => new QueryWorker());

  useEffect(() => {
    if (queryFieldsMap && selectedSObject) {
      queryWorker.postMessage({
        name: 'calculateFilter',
        data: queryFieldsMap,
      });
    } else {
      setFilterFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, queryFieldsMap, selectedFields]);

  useEffect(() => {
    let timer1;
    if (!selectedSObject) {
      setShowRightHandPane(false);
      timer1 = undefined;
    } else {
      setShowRightHandPane(false);
      timer1 = setTimeout(() => setShowRightHandPane(true));
    }
    return () => {
      if (timer1) {
        clearTimeout(timer1);
      }
    };
  }, [selectedSObject]);

  useEffect(() => {
    if (queryWorker) {
      queryWorker.onmessage = (event: MessageEvent) => {
        const payload: WorkerMessage<'calculateFilter', ListItemGroup[]> = event.data;
        logger.log({ payload });
        switch (payload.name) {
          case 'calculateFilter': {
            setFilterFields(payload.data);
            break;
          }
          default:
            break;
        }
      };
    }
  }, [queryWorker, setFilterFields]);

  return (
    <Fragment>
      <QueryBuilderSoqlUpdater />
      <Page>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle icon={{ type: 'standard', icon: 'entity' }} label="Query Records" />
            <PageHeaderActions colType="actions" buttonType="separate">
              <QueryResetButton />
              <button className={classNames('slds-button slds-button_neutral')} aria-haspopup="true" title="Favorites">
                <Icon type="utility" icon="favorite" className="slds-button__icon slds-button__icon_left" omitContainer />
                View Favorites
              </button>
              <button
                className={classNames('slds-button slds-button_neutral', {
                  'slds-is-selected': isFavorite && false,
                })}
                aria-haspopup="true"
                title="Favorites"
              >
                <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
                View History
              </button>
              {soql && (
                <Link
                  className="slds-button slds-button_brand"
                  to={{
                    pathname: `${match.url}/results`,
                    state: { soql },
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
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none">
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
              <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
              <QuerySObjects />
            </div>
            <div className="slds-p-horizontal_x-small">
              {selectedSObject && (
                <Fragment>
                  <h2 className="slds-text-heading_medium slds-text-align_center slds-truncate">{selectedSObject?.name} Fields</h2>
                  <QueryFieldsComponent selectedSObject={selectedSObject} onSelectionChanged={setSelectedFields} />
                </Fragment>
              )}
            </div>
            <div className="slds-p-horizontal_x-small">
              {showRightHandPane && (
                <AutoFullHeightContainer>
                  <Accordion
                    initOpenIds={['filters', 'orderBy', 'limit', 'soql']}
                    sections={[
                      {
                        id: 'filters',
                        title: 'Filters',
                        content: <QueryFilter fields={filterFields} />,
                      },
                      { id: 'orderBy', title: 'Order By', content: <QueryOrderBy fields={filterFields} /> },
                      { id: 'limit', title: 'Limit', content: <QueryLimit /> },
                      { id: 'soql', title: 'Soql Query', content: <SoqlTextarea /> },
                    ]}
                    allowMultiple={true}
                  ></Accordion>
                </AutoFullHeightContainer>
              )}
            </div>
          </Split>
        </AutoFullHeightContainer>
      </Page>
    </Fragment>
  );
};

export default QueryBuilder;
