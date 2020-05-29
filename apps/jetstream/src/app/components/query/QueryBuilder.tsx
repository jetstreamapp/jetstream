/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { MapOf, QueryFields, WorkerMessage } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithMinWidth,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Accordion,
} from '@jetstream/ui';
import classNames from 'classnames';
import { DescribeGlobalSObjectResult, SObject } from 'jsforce';
import { FunctionComponent, useEffect, useState, Fragment } from 'react';
import { Link, useLocation, useRouteMatch } from 'react-router-dom';
import { getField } from 'soql-parser-js';
import QueryWorker from '../../workers/query.worker';
import QueryFieldsComponent from './QueryFields';
import QueryFilter from './QueryFilter';
import SoqlTextarea from './QueryOptions/SoqlTextarea';
import QuerySObjects from './QuerySObjects';
import Split from 'react-split';

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
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none">
        <Split
          sizes={[17, 33, 50]}
          minSize={[200, 300, 300]}
          gutterSize={activeSObject ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
            <QuerySObjects onSelected={(sobject) => setActiveSObject(sobject)} />
          </div>
          <div className="slds-p-horizontal_x-small">
            {activeSObject && (
              <Fragment>
                <h2 className="slds-text-heading_medium slds-text-align_center slds-truncate">{activeSObject?.name} Fields</h2>
                <QueryFieldsComponent
                  activeSObject={activeSObject}
                  onSelectionChanged={setSelectedFields}
                  onFieldsFetched={setQueryFieldsMap}
                />
              </Fragment>
            )}
          </div>
          <div className="slds-p-horizontal_x-small">
            {activeSObject && (
              <AutoFullHeightContainer>
                <Accordion
                  initOpenIds={['filters', 'orderBy', 'soql']}
                  sections={[
                    { id: 'filters', title: 'Filters', content: <QueryFilter onChange={(filters) => console.log({ filters })} /> },
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
