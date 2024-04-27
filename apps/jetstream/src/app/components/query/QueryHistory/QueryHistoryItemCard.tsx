import { IconObj } from '@jetstream/icon-factory';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem } from '@jetstream/types';
import { ButtonGroupContainer, Card, CopyToClipboard, Grid, GridCol, Icon, Textarea } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import { formatDate } from 'date-fns/format';
import clamp from 'lodash/clamp';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

const REM_PER_LINE = 1.1;

export interface QueryHistoryItemCardProps {
  isOnSavedQueries: boolean;
  item: QueryHistoryItem;
  onExecute: (item: QueryHistoryItem) => void;
  onSave: (item: QueryHistoryItem, value: boolean) => void;
  startRestore: () => void;
  endRestore: (isTooling: boolean, fatalError: boolean, errors?: any) => void;
}

export const QueryHistoryItemCard: FunctionComponent<QueryHistoryItemCardProps> = ({
  isOnSavedQueries,
  item,
  onExecute,
  onSave,
  startRestore,
  endRestore,
}) => {
  const { sObject, label, soql, isTooling, runCount, lastRun } = item;
  const isMounted = useRef(true);
  const timerRef = useRef<any>();
  const [lineCount, setLineCount] = useState(Math.max(soql.split('\n').length, 2));

  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (soql) {
      setLineCount(Math.max(soql.split('\n').length, 2));
    }
  }, [soql]);

  function handleSave(value: boolean) {
    if (!value && isOnSavedQueries) {
      // delay to allow user to undo action
      setIsRemoving(true);
      timerRef.current = setTimeout(() => {
        onSave(item, value);
      }, 5000);
    } else {
      if (isRemoving) {
        clearTimeout(timerRef.current);
        setIsRemoving(false);
      } else {
        onSave(item, value);
      }
    }
  }

  return (
    <Card
      className="modal-card-override"
      icon={isTooling ? METADATA_QUERY_ICON : SOBJECT_QUERY_ICON}
      testId={`query-history-${soql}`}
      title={
        <Grid wrap>
          <GridCol size={12}>
            <span>{label}</span>
          </GridCol>
          <GridCol className="slds-text-body_small slds-text-color_weak">{sObject}</GridCol>
        </Grid>
      }
      actions={
        <ButtonGroupContainer>
          {item.isFavorite && !isRemoving ? (
            <button className="slds-button slds-button_brand" onClick={() => handleSave(false)}>
              <Icon type="utility" icon="check" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
              Saved
            </button>
          ) : (
            <button className="slds-button slds-button_neutral" onClick={() => handleSave(true)}>
              <Icon
                type="utility"
                icon="favorite"
                description="Manually enter query"
                className="slds-button__icon slds-button__icon_left"
              />
              Save
            </button>
          )}
          <RestoreQuery
            soql={soql}
            isTooling={isTooling}
            className="slds-button_neutral slds-button_middle"
            startRestore={startRestore}
            endRestore={endRestore}
          />
          <Link
            className="slds-button slds-button_neutral"
            onClick={() => onExecute(item)}
            to="/query/results"
            state={{
              soql,
              isTooling,
              sobject: {
                label,
                name: sObject,
              },
            }}
          >
            <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
            Execute
          </Link>
        </ButtonGroupContainer>
      }
    >
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
                  language="soql"
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
                    scrollbar: {
                      alwaysConsumeMouseWheel: false,
                      handleMouseWheel: false,
                    },
                  }}
                />
              </Textarea>
            </div>
          )}
        </GridCol>
      </Grid>
    </Card>
  );
};

export default QueryHistoryItemCard;
