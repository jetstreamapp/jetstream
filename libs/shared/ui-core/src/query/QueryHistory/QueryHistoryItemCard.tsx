import { IconObj } from '@jetstream/icon-factory';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, DATE_FORMATS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, Card, CopyToClipboard, Grid, GridCol, Icon, Spinner, Textarea, useEscapeToCloseLayer } from '@jetstream/ui';
import { queryHistoryDb } from '@jetstream/ui/db';
import { isQueryValid } from '@jetstreamapp/soql-parser-js';
import { formatDate } from 'date-fns/format';
import clamp from 'lodash/clamp';
import { FunctionComponent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAmplitude } from '../..';
import { MonacoEditor } from '../../app/MonacoEditor';
import { QueryRestoreErrors } from '../RestoreQuery/query-restore-utils';
import { RestoreQuery } from '../RestoreQuery/RestoreQuery';
import { SoqlValidIndicator } from '../ValidQueryText';

const SOBJECT_QUERY_ICON: IconObj = { type: 'standard', icon: 'record_lookup', description: 'Object Query' };
const METADATA_QUERY_ICON: IconObj = { type: 'standard', icon: 'settings', description: 'Metadata Query' };

const REM_PER_LINE = 1.1;

export interface QueryHistoryItemCardProps {
  isOnSavedQueries: boolean;
  item: QueryHistoryItem;
  selectedOrg: SalesforceOrgUi;
  onExecute: (item: QueryHistoryItem) => void;
  onSave: (item: QueryHistoryItem, value: boolean) => void;
  /** Called after a save is persisted. `updatedKey` may DIFFER from `item.key` (the key derives from
   * the SOQL text), in which case this card unmounts on refresh — the parent owns focus recovery. */
  onQueryUpdated?: (updatedKey: QueryHistoryItem['key']) => void;
  startRestore: () => void;
  endRestore: (isTooling: boolean, fatalError: boolean, errors?: QueryRestoreErrors) => void;
}

export const QueryHistoryItemCard: FunctionComponent<QueryHistoryItemCardProps> = ({
  isOnSavedQueries,
  item,
  selectedOrg,
  onExecute,
  onSave,
  onQueryUpdated,
  startRestore,
  endRestore,
}) => {
  const [currentItem, setCurrentItem] = useState(item);
  const { sObject, customLabel, label, soql, isTooling, runCount, lastRun } = currentItem;
  const { trackEvent } = useAmplitude();
  const isMounted = useRef(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timerRef = useRef<any>(null);
  const [lineCount, setLineCount] = useState(Math.max(soql.split('\n').length, 2));

  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const soqlEditorId = useId();
  // Escape while editing cancels the edit (and is consumed here) instead of closing the whole
  // Query History modal and discarding the unsaved changes with it
  useEscapeToCloseLayer(isEditing, () => handleCancelEdit());
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [editedSoql, setEditedSoql] = useState(soql);
  const [editedCustomLabel, setEditedCustomLabel] = useState(customLabel || label);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryIsValid, setQueryIsValid] = useState(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Update currentItem when the prop changes
    setCurrentItem(item);
  }, [item]);

  useEffect(() => {
    if (soql) {
      setLineCount(Math.max(soql.split('\n').length, 2));
    }
  }, [soql]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    if (editedSoql) {
      setLineCount(Math.max(editedSoql.split('\n').length, 2));
      if (isQueryValid(editedSoql)) {
        setQueryIsValid(true);
      } else {
        setQueryIsValid(false);
      }
    } else {
      setQueryIsValid(false);
    }
  }, [isEditing, editedSoql]);

  function handleSave(value: boolean) {
    if (!value && isOnSavedQueries) {
      // delay to allow user to undo action
      setIsRemoving(true);
      timerRef.current = setTimeout(() => {
        onSave(currentItem, value);
        // Update local state
        setCurrentItem((prev) => ({ ...prev, isFavorite: value }));
      }, 5000);
    } else {
      if (isRemoving) {
        clearTimeout(timerRef.current);
        setIsRemoving(false);
      } else {
        onSave(currentItem, value);
        // Update local state
        setCurrentItem((prev) => ({ ...prev, isFavorite: value }));
      }
    }
  }

  /** Return focus to the Edit button after leaving edit mode — the buttons the user activated unmount */
  function focusEditButton() {
    window.setTimeout(() => editButtonRef.current?.focus());
  }

  async function handleEdit() {
    setIsEditing(true);
    setEditedSoql(soql);
    setEditedCustomLabel(customLabel || label);
    setError(null);
    trackEvent(ANALYTICS_KEYS.query_HistoryEditQueryOpened, { location: 'inline' });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedSoql(soql);
    setEditedCustomLabel(customLabel || label);
    setError(null);
    focusEditButton();
  }

  async function handleSaveEdit() {
    const soqlChanged = editedSoql !== soql;
    const nameChanged = customLabel ? editedCustomLabel.trim() !== customLabel : editedCustomLabel.trim() !== label;

    if (!soqlChanged && !nameChanged) {
      setIsEditing(false);
      focusEditButton();
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      let updatedItem = currentItem;

      updatedItem = await queryHistoryDb.updateSavedQuery(selectedOrg, updatedItem, editedSoql, editedCustomLabel.trim(), isTooling);

      trackEvent(ANALYTICS_KEYS.query_HistoryUpdateQuery, {
        location: 'inline',
        soqlChanged,
        nameChanged,
      });

      // Update the local state to reflect the saved changes
      setCurrentItem(updatedItem);

      // Exit edit mode
      setIsEditing(false);
      setIsSaving(false);
      focusEditButton();

      // Notify parent to refresh the list. Editing the SOQL changes the item's key (it derives from
      // the query text), which remounts this card on refresh and unmounts the Edit button that
      // focusEditButton() just targeted — the parent restores focus to the new card by this key.
      if (onQueryUpdated) {
        onQueryUpdated(updatedItem.key);
      }
    } catch (ex) {
      logger.error('[ERROR] Failed to update saved query', ex);
      setError('Failed to update query. Please try again.');
      setIsSaving(false);
    }
  }

  function isSaveDisabled() {
    if (!queryIsValid) {
      return true;
    }
    const isLabelDirty = customLabel ? editedCustomLabel.trim() !== customLabel : editedCustomLabel !== label;
    if (editedSoql === soql && !isLabelDirty) {
      return true;
    }
    return isSaving;
  }

  return (
    <Card
      className="modal-card-override"
      actionsAlignment={isEditing ? 'start' : undefined}
      icon={isTooling ? METADATA_QUERY_ICON : SOBJECT_QUERY_ICON}
      testId={`query-history-${soql}`}
      title={
        <Grid wrap>
          <GridCol size={12}>
            {isEditing ? (
              <input
                id={`${soqlEditorId}-label`}
                aria-label="Query label"
                className="slds-input"
                autoFocus
                placeholder="Leave empty to use default label"
                value={editedCustomLabel}
                onChange={(e) => setEditedCustomLabel(e.target.value)}
              />
            ) : (
              <span>{customLabel ?? label}</span>
            )}
          </GridCol>
          <GridCol className="slds-text-body_small slds-text-color_weak">{sObject}</GridCol>
        </Grid>
      }
      actions={
        <>
          {isSaving && <Spinner size="x-small" />}
          {isEditing ? (
            <>
              <button className="slds-button slds-button_neutral" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleSaveEdit} disabled={isSaveDisabled()}>
                Save Changes
              </button>
            </>
          ) : (
            <ButtonGroupContainer>
              {/* One stable toggle button (aria-pressed) — two swapped buttons dropped focus on
                  toggle, and the stray icon description garbled the announcement */}
              {(() => {
                const isSaved = currentItem.isFavorite && !isRemoving;
                return (
                  <button
                    className={isSaved ? 'slds-button slds-button_brand' : 'slds-button slds-button_neutral'}
                    aria-pressed={isSaved}
                    onClick={() => handleSave(!isSaved)}
                  >
                    <Icon type="utility" icon={isSaved ? 'check' : 'favorite'} className="slds-button__icon slds-button__icon_left" />
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                );
              })()}
              {/* Deterministic id so the parent can focus THIS query's Edit button across a remount
                  (the card's key changes when its SOQL is edited) */}
              <button id={`edit-query-${item.key}`} ref={editButtonRef} className="slds-button slds-button_neutral" onClick={handleEdit}>
                <Icon type="utility" icon="edit" description="Edit query" className="slds-button__icon slds-button__icon_left" />
                Edit
              </button>
              <RestoreQuery
                soql={soql}
                isTooling={isTooling}
                className="slds-button_neutral slds-button_middle"
                startRestore={startRestore}
                endRestore={endRestore}
              />
              <Link
                className="slds-button slds-button_neutral"
                onClick={() => onExecute(currentItem)}
                to={`${APP_ROUTES.QUERY.ROUTE}/results`}
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
          )}
        </>
      }
    >
      <Grid wrap className="slds-m-bottom_x-small slds-scrollable_x">
        <GridCol size={12} className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">
          Last Run: {formatDate(lastRun, DATE_FORMATS.FULL)} - Run: {runCount} {pluralizeFromNumber('time', runCount)}
        </GridCol>
        {error && (
          <GridCol size={12}>
            <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_x-small" role="alert">
              <span className="slds-assistive-text">error</span>
              <h2>{error}</h2>
            </div>
          </GridCol>
        )}
        <GridCol>
          {soql && (
            <div>
              <Textarea
                id={soqlEditorId}
                label={
                  <span>
                    SOQL Query
                    {!isEditing && <CopyToClipboard className="slds-m-left--xx-small" content={soql} />}
                  </span>
                }
              >
                <MonacoEditor
                  height={`${clamp(lineCount * REM_PER_LINE, 2, 11)}rem`}
                  language="soql"
                  value={isEditing ? editedSoql : soql}
                  onChange={isEditing ? (value) => setEditedSoql(value || '') : undefined}
                  options={{
                    // The visible "SOQL Query" label cannot target Monaco's internal textarea, so name it directly
                    ariaLabel: 'SOQL Query',
                    readOnly: !isEditing,
                    minimap: { enabled: false },
                    tabSize: 2,
                    contextmenu: isEditing,
                    lineNumbers: 'off',
                    glyphMargin: false,
                    folding: false,
                    selectionHighlight: isEditing,
                    renderLineHighlight: isEditing ? 'all' : 'none',
                    scrollBeyondLastLine: false,
                    scrollbar: {
                      alwaysConsumeMouseWheel: false,
                      handleMouseWheel: lineCount * REM_PER_LINE > 11 || isEditing,
                    },
                  }}
                />
              </Textarea>
              {isEditing && (
                <>
                  <SoqlValidIndicator soql={editedSoql} queryIsValid={queryIsValid} />
                  <div className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                    Note: Modifying the query will create a new entry in your history while preserving metadata like run count and creation
                    date.
                  </div>
                </>
              )}
            </div>
          )}
        </GridCol>
      </Grid>
    </Card>
  );
};

export default QueryHistoryItemCard;
