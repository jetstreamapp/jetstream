import { IconObj } from '@jetstream/icon-factory';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem } from '@jetstream/types';
import { Card, CheckboxButton, CodeEditor, CopyToClipboard, Grid, GridCol, Icon, Textarea } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryHistoryItemCardProps {
  item: QueryHistoryItem;
  onExecute: (item: QueryHistoryItem) => void;
  onSave: (item: QueryHistoryItem, value: boolean) => void;
  startRestore: () => void;
  endRestore: (isTooling: boolean, fatalError: boolean, errors?: any) => void;
}

export const QueryHistoryItemCard: FunctionComponent<QueryHistoryItemCardProps> = ({
  item,
  onExecute,
  onSave,
  startRestore,
  endRestore,
}) => {
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

  const { sObject, label, soql, isTooling, runCount, lastRun } = item;

  return (
    <Fragment>
      <Card
        className="modal-card-override"
        icon={isTooling ? METADATA_QUERY_ICON : SOBJECT_QUERY_ICON}
        title={
          <Fragment>
            <Grid wrap>
              <GridCol size={12}>
                <span>{label}</span>
              </GridCol>
              <GridCol className="slds-text-body_small slds-text-color_weak">{sObject}</GridCol>
            </Grid>
          </Fragment>
        }
        // icon={{ type: 'standard', icon: 'account', description: 'Account' }}
        actions={
          <Fragment>
            <CheckboxButton
              id={item.key}
              className="slds-m-right_x-small"
              checked={!!item.isFavorite}
              label="Save Query"
              checkedLabel="Query is saved"
              icon="add"
              iconChecked="check"
              onChange={(value) => onSave(item, value)}
            />
            <RestoreQuery
              soql={soql}
              isTooling={isTooling}
              className="slds-button_neutral slds-m-right_x-small"
              startRestore={startRestore}
              endRestore={endRestore}
            />
            <Link
              className="slds-button slds-button_neutral"
              onClick={() => onExecute(item)}
              to={{
                pathname: `${match.url}/results`,
                state: {
                  soql,
                  isTooling,
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
              Last Run: {formatDate(lastRun, DATE_FORMATS.FULL)} - Run: {runCount} {pluralizeFromNumber('time', runCount)}
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
                      className="CodeMirror-full-height"
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
