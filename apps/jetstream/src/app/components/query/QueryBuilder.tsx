/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { convertFiltersToWhereClause, useDebounce } from '@jetstream/shared/ui-utils';
import { WorkerMessage } from '@jetstream/types';
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
import { Link, useLocation, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { getField } from 'soql-parser-js';
import { selectedOrgState } from '../../app-state';
import QueryWorker from '../../workers/query.worker';
import * as fromQueryState from './query.state';
import QueryFieldsComponent from './QueryFields';
import QueryFilter from './QueryFilter';
import SoqlTextarea from './QueryOptions/SoqlTextarea';
import QuerySObjects from './QuerySObjects';
import { logger } from '@jetstream/shared/client-logger';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryBuilderProps {}

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();

  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const queryFieldsMap = useRecoilValue(fromQueryState.queryFieldsMapState);
  const filters = useRecoilValue(fromQueryState.queryFiltersState);
  const [selectedFields, setSelectedFields] = useRecoilState(fromQueryState.selectedQueryFieldsState);
  const [filterFields, setFilterFields] = useRecoilState(fromQueryState.filterQueryFieldsState);
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);
  const [isFavorite, setIsFavorite] = useRecoilState(fromQueryState.queryIsFavoriteState);

  const debouncedFilters = useDebounce(filters);

  const [queryWorker, setQueryWorker] = useState(() => new QueryWorker());
  const selectedOrg = useRecoilValue(selectedOrgState);

  useEffect(() => {
    if (!!selectedSObject && selectedFields?.length > 0) {
      if (queryWorker) {
        queryWorker.postMessage({
          name: 'composeQuery',
          data: {
            query: {
              sObject: selectedSObject.name,
              fields: selectedFields.map((field) => getField(field)),
            },
            whereExpression: debouncedFilters,
          },
        });
      }
    } else {
      setSoql('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, selectedFields, debouncedFilters]);

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
    if (queryWorker) {
      queryWorker.onmessage = (event: MessageEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: WorkerMessage<'composeQuery' | 'calculateFilter', any> = event.data;
        logger.log({ payload });
        switch (payload.name) {
          case 'composeQuery': {
            if (payload.error) {
              // TODO:
            } else {
              setSoql(payload.data);
            }
            break;
          }
          case 'calculateFilter': {
            setFilterFields(payload.data);
            break;
          }
          default:
            break;
        }
        if (payload.name === 'composeQuery') {
          if (payload.error) {
            // TODO:
          } else {
            setSoql(payload.data);
          }
        }
      };
    }
  }, [queryWorker, setFilterFields, setSoql]);

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'action', icon: 'record' }} label="Query Records" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className={classNames('slds-button slds-button_neutral slds-button_last')} aria-haspopup="true" title="Favorites">
              <Icon type="utility" icon="favorite" className="slds-button__icon slds-button__icon_left" omitContainer />
              View Favorites
            </button>
            <button
              className={classNames('slds-button slds-button_neutral slds-button_last', {
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
            {selectedSObject && (
              <AutoFullHeightContainer>
                <Accordion
                  initOpenIds={['filters', 'orderBy', 'soql']}
                  sections={[
                    {
                      id: 'filters',
                      title: 'Filters',
                      content: <QueryFilter fields={filterFields} />,
                    },
                    { id: 'orderBy', title: 'Order By', content: 'TODO' },
                    { id: 'soql', title: 'Soql Query', content: <SoqlTextarea soql={soql} /> },
                  ]}
                  allowMultiple={true}
                ></Accordion>
              </AutoFullHeightContainer>
            )}
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default QueryBuilder;
