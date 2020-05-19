/* eslint-disable @typescript-eslint/no-unused-vars */
import { MapOf, QueryFields } from '@silverthorn/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useLocation, useRouteMatch } from 'react-router-dom';
import { composeQuery, getField } from 'soql-parser-js';
import { Icon, SobjectList } from '@silverthorn/ui';
import { Toolbar } from '@silverthorn/ui';
import { ToolbarItemActions } from '@silverthorn/ui';
import QueryFieldsComponent from './QueryFields';
import SoqlTextarea from './QueryOptions/SoqlTextarea';
import classNames from 'classnames';
import { ButtonRowContainer } from '@silverthorn/ui';
import { ButtonRowItem } from '@silverthorn/ui';
import QuerySObjects from './QuerySObjects';

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

  // TODO: this is slow, consider moving to webworker and have it update in the background?
  useEffect(() => {
    if (!!activeSObject && selectedFields?.length > 0) {
      // ensure that this is processed in the next tick to keep checkbox UI fast
      setTimeout(() => {
        setSoql(composeQuery({ sObject: activeSObject.name, fields: selectedFields.map((field) => getField(field)) }, { format: true }));
      });
    } else {
      setSoql('');
    }
  }, [activeSObject, selectedFields]);

  return (
    <Fragment>
      <Toolbar>
        <ToolbarItemActions>
          <ButtonRowContainer>
            <ButtonRowItem>
              <button className={classNames('slds-button slds-button_neutral slds-button_last')} aria-haspopup="true" title="Favorites">
                <Icon type="utility" icon="favorite" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
                View Favorites
              </button>
            </ButtonRowItem>
            <ButtonRowItem>
              <button
                className={classNames('slds-button slds-button_neutral slds-button_last', {
                  'slds-is-selected': isFavorite && false,
                })}
                aria-haspopup="true"
                title="Favorites"
              >
                <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
                View History
              </button>
            </ButtonRowItem>
            <ButtonRowItem>
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
            </ButtonRowItem>
          </ButtonRowContainer>
        </ToolbarItemActions>
      </Toolbar>
      <div className="slds-grid slds-gutters">
        <div className="slds-col slds-size_1-of-3 slds-is-relative">
          <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
          <QuerySObjects onSelected={(sobject) => setActiveSObject(sobject)} />
        </div>
        <div className="slds-col slds-size_1-of-3 slds-is-relative">
          <h2 className="slds-text-heading_medium slds-text-align_center slds-truncate">{activeSObject?.name} Fields</h2>
          {activeSObject && (
            <QueryFieldsComponent
              activeSObject={activeSObject}
              onSelectionChanged={setSelectedFields}
              onFieldsFetched={setQueryFieldsMap}
            />
          )}
        </div>
        <div className="slds-col slds-size_1-of-3 slds-is-relative">
          <h2 className="slds-text-heading_medium slds-text-align_center">Other Configuration</h2>
          <SoqlTextarea soql={soql} />
        </div>
      </div>
    </Fragment>
  );
};

export default QueryBuilder;
