import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem } from '@jetstream/types';
import { Card, CodeEditor, CopyToClipboard, Grid, GridCol, Icon, Textarea } from '@jetstream/ui';
import moment from 'moment-mini';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryHistoryItemCardProps {
  item: QueryHistoryItem;
  startRestore: () => void;
  endRestore: (fatalError: boolean, errors?: any) => void;
}

export const QueryHistoryItemCard: FunctionComponent<QueryHistoryItemCardProps> = ({ item, startRestore, endRestore }) => {
  const isMounted = useRef(null);
  const match = useRouteMatch();
  const [readyToRenderCode, setReadyToRenderCode] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (isMounted.current) {
        setReadyToRenderCode(true);
      }
    });
  }, []);

  const { sObject, label, soql, runCount, lastRun } = item;

  return (
    <Fragment>
      <Card
        className="modal-card-override"
        title={
          <Fragment>
            <Grid wrap>
              <GridCol size={12}>{label}</GridCol>
              <GridCol className="slds-text-body_small slds-text-color_weak">{sObject}</GridCol>
            </Grid>
          </Fragment>
        }
        // icon={{ type: 'standard', icon: 'account', description: 'Account' }}
        actions={
          <Fragment>
            <RestoreQuery
              soql={soql}
              className="slds-button_neutral slds-m-right_x-small"
              startRestore={startRestore}
              endRestore={endRestore}
            />
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
          </Fragment>
        }
      >
        <Fragment>
          <Grid wrap className="slds-m-bottom_x-small slds-scrollable_x">
            <GridCol size={12} className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">
              Last Run: {moment(lastRun).format('LLL')} - Run: {runCount} {pluralizeFromNumber('time', runCount)}
            </GridCol>
            <GridCol>
              {soql && (
                <div>
                  <Textarea
                    id="soql"
                    label={
                      <span>
                        SOQL Query
                        <CopyToClipboard className="slds-m-left--xx-small" content={soql} />
                      </span>
                    }
                  >
                    <CodeEditor
                      className="CodeMirror-soql-history"
                      value={soql}
                      readOnly
                      size={{ height: 'auto' }}
                      shouldRefresh={readyToRenderCode}
                    />
                  </Textarea>
                </div>
              )}
            </GridCol>
          </Grid>
        </Fragment>
      </Card>
    </Fragment>
  );
};

export default QueryHistoryItemCard;
