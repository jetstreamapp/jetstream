import { IconObj } from '@jetstream/icon-factory';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem } from '@jetstream/types';
import { Card, CheckboxButton, CopyToClipboard, Grid, GridCol, Icon, Textarea } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import formatDate from 'date-fns/format';
import clamp from 'lodash/clamp';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

const REM_PER_LINE = 1.1;

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
  const { sObject, label, soql, isTooling, runCount, lastRun } = item;
  const isMounted = useRef(null);
  const match = useRouteMatch();
  const [readyToRenderCode, setReadyToRenderCode] = useState(false);
  const [lineCount, setLineCount] = useState(Math.max(soql.split('\n').length, 2));

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

  useEffect(() => {
    if (soql) {
      setLineCount(Math.max(soql.split('\n').length, 2));
    }
  }, [soql]);

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
                    <Editor
                      height={`${clamp(lineCount * REM_PER_LINE, 2, 11)}rem`}
                      language="sql"
                      value={soql}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        contextmenu: false,
                        lineNumbers: 'off',
                        glyphMargin: false,
                        folding: false,
                        lineDecorationsWidth: 0,
                        lineNumbersMinChars: 0,
                        selectionHighlight: false,
                        renderLineHighlight: 'none',
                        scrollBeyondLastLine: false,
                      }}
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
