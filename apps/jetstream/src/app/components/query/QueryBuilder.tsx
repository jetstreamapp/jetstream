/* eslint-disable @typescript-eslint/no-unused-vars */
import { MapOf, QueryFields, WorkerMessage } from '@silverthorn/types';
import {
  AutoFullHeightContainer,
  ColumnWithMinWidth,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@silverthorn/ui';
import classNames from 'classnames';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link, useLocation, useRouteMatch } from 'react-router-dom';
import { composeQuery, getField } from 'soql-parser-js';
import QueryFieldsComponent from './QueryFields';
import SoqlTextarea from './QueryOptions/SoqlTextarea';
import QuerySObjects from './QuerySObjects';
import QueryWorker from '../../workers/query.worker';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryBuilderProps {}

export const QueryBuilder: FunctionComponent<QueryBuilderProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();
  const [activeSObject, setActiveSObject] = useState<DescribeGlobalSObjectResult>(null);
  const [queryFieldsMap, setQueryFieldsMap] = useState<MapOf<QueryFields>>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [soql, setSoql] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [queryWorker, setQueryWorker] = useState(() => new QueryWorker());

  useEffect(() => {
    if (!!activeSObject && selectedFields?.length > 0) {
      if (queryWorker) {
        queryWorker.postMessage({
          name: 'composeQuery',
          data: { sObject: activeSObject.name, fields: selectedFields.map((field) => getField(field)) },
        });
      }
    } else {
      setSoql('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSObject, selectedFields]);

  useEffect(() => {
    if (queryWorker) {
      queryWorker.onmessage = (event: MessageEvent) => {
        const payload: WorkerMessage<'composeQuery', string> = event.data;
        if (payload.name === 'composeQuery') {
          if (payload.error) {
            // TODO:
          } else {
            setSoql(payload.data);
          }
        }
      };
    }
  }, [queryWorker]);

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
      <AutoFullHeightContainer fillHeight className="slds-p-horizontal_x-small slds-scrollable_none">
        <div className="slds-grid slds-gutters">
          <ColumnWithMinWidth className="slds-size_1-of-3 slds-is-relative">
            <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
            <QuerySObjects onSelected={(sobject) => setActiveSObject(sobject)} />
          </ColumnWithMinWidth>
          <ColumnWithMinWidth className="slds-size_1-of-3 slds-is-relative">
            <h2 className="slds-text-heading_medium slds-text-align_center slds-truncate">{activeSObject?.name} Fields</h2>
            {activeSObject && (
              <QueryFieldsComponent
                activeSObject={activeSObject}
                onSelectionChanged={setSelectedFields}
                onFieldsFetched={setQueryFieldsMap}
              />
            )}
          </ColumnWithMinWidth>
          <ColumnWithMinWidth className="slds-size_1-of-3 slds-is-relative">
            <SoqlTextarea soql={soql} />
          </ColumnWithMinWidth>
        </div>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default QueryBuilder;
