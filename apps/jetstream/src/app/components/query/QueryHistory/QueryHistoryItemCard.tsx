import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem } from '@jetstream/types';
import { Card, Grid, GridCol, Icon } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import moment from 'moment-mini';
import { useRouteMatch, Link } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryHistoryItemCardProps {
  item: QueryHistoryItem;
}

export const QueryHistoryItemCard: FunctionComponent<QueryHistoryItemCardProps> = ({ item }) => {
  const match = useRouteMatch();

  const { sObject, label, soql, runCount, lastRun } = item;

  return (
    <Fragment>
      <Card
        title={
          <Fragment>
            <Grid wrap>
              <GridCol size={12}>{label}</GridCol>
              <GridCol className="slds-text-body_small slds-text-color_weak">{sObject}</GridCol>
            </Grid>
          </Fragment>
        }
        icon={{ type: 'standard', icon: 'account', description: 'Account' }}
        actions={
          <Link
            className="slds-button slds-button_neutral"
            to={{
              pathname: `${match.url}/results`,
              state: {
                soql,
                sobject: {
                  label,
                  name: sObject,
                },
              },
            }}
          >
            <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
            Execute
          </Link>
        }
      >
        <Fragment>
          <Grid wrap>
            <GridCol size={12} className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">
              Last Run: {moment(lastRun).format('LLL')} - Run: {runCount} {pluralizeFromNumber('time', runCount)}
            </GridCol>
            <GridCol className="slds-p-around_xx-small is-disabled border-radius-25 slds-scrollable_y">
              <div className="slds-text-font_monospace" title={soql} style={{ maxHeight: 75 }}>
                {soql}
              </div>
            </GridCol>
          </Grid>
        </Fragment>
      </Card>
    </Fragment>
  );
};

export default QueryHistoryItemCard;
