import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import {
  hasModifierKey,
  hasShiftModifierKey,
  isArrowDownKey,
  isEKey,
  isEnterKey,
  sanitizePastedEditorText,
  useDisposables,
  useGlobalEventHandler,
} from '@jetstream/shared/ui-utils';
import { QueryHistoryItem, SoqlQueryFormatOptions } from '@jetstream/types';
import {
  CheckboxToggle,
  focusListEntryRow,
  getAriaKeyshortcuts,
  getModifierKey,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  List,
  Popover,
  PopoverRef,
  Spinner,
  Textarea,
  Tooltip,
} from '@jetstream/ui';
import { selectedOrgState, soqlQueryFormatOptionsState } from '@jetstream/ui/app-state';
import { getDexieDb } from '@jetstream/ui/db';
import { formatQuery, isQueryValid } from '@jetstreamapp/soql-parser-js';
import { OnMount } from '@monaco-editor/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom, useAtomValue } from 'jotai';
import type { editor } from 'monaco-editor';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAmplitude } from '../analytics';
import { MonacoEditor } from '../app/MonacoEditor';
import { fromJetstreamEvents } from '../jetstream-events';
import { SoqlQueryFormatConfigPopover } from '../settings/SoqlQueryFormatConfigPopover';
import { QueryHistoryModal } from './QueryHistory/QueryHistoryModal';
import { useQueryRestore } from './RestoreQuery/useQueryRestore';

const NUM_HISTORY_ITEMS = 50;

export const QuickQueryPopover = () => {
  const { trackEvent } = useAmplitude();
  const popoverRef = useRef<PopoverRef>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const recentQueriesListRef = useRef<HTMLUListElement>(null);
  const { addDisposable } = useDisposables();
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);

  const [soql, setSoql] = useState<string>('');
  const [queryIsValid, setQueryIsValid] = useState(false);
  const [isTooling, setIsTooling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [soqlQueryFormatOptions, setSoqlQueryFormatOptions] = useAtom(soqlQueryFormatOptionsState);

  const [queryHistoryModalOpen, setQueryHistoryModalOpen] = useState(false);

  const [restore] = useQueryRestore(soql, isTooling, {
    startRestore: () => {
      setIsRestoring(true);
    },
    endRestore: () => {
      popoverRef.current?.close();
      setIsRestoring(false);
      navigate('/query');
    },
  });

  // Note: this is not scoped to the current org, which I guess is fine for now (could give user an option)
  const queryHistory = useLiveQuery(
    // Since we want to sort by lastRun, we cannot use a normal where clause
    () => getDexieDb().query_history.orderBy('lastRun').reverse().limit(NUM_HISTORY_ITEMS).toArray(),
    [],
    [] as QueryHistoryItem[],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueryIsValid(!!soql && isQueryValid(soql));
  }, [soql]);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (hasModifierKey(event as any) && isEKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        popoverRef.current?.open();
        trackEvent(ANALYTICS_KEYS.quick_query_Open, { method: 'keyboard' });
      }
    },
    [trackEvent],
  );

  useGlobalEventHandler('keydown', onKeydown);

  function handleFormat() {
    setSoql(formatQuery(soql, soqlQueryFormatOptions));
  }

  function handleOpenQueryHistory() {
    popoverRef.current?.close();
    setQueryHistoryModalOpen(true);
    trackEvent(ANALYTICS_KEYS.query_HistoryModalOpened, { source: 'quick_query', type: 'HISTORY' });
  }

  function handleRestore(soqlOverride?: string, isToolingOverride?: boolean, skipTracking = false) {
    restore(soqlOverride || soql, isToolingOverride ?? isTooling);
    if (!skipTracking) {
      trackEvent(ANALYTICS_KEYS.quick_query_Restore, { method: 'button', location: 'popover' });
    }
  }

  function handleExecute(soqlOverride?: string, isToolingOverride?: boolean, skipTracking = false) {
    popoverRef.current?.close();
    navigate('/query/results', {
      state: {
        isTooling: isToolingOverride ?? isTooling,
        soql: soqlOverride || soql,
      },
    });
    if (!skipTracking) {
      trackEvent(ANALYTICS_KEYS.quick_query_Execute, { method: 'button', location: 'popover' });
    }
  }

  function selectRecentQuery(query: QueryHistoryItem) {
    setSoql(query.soql);
    setIsTooling(query.isTooling);
  }

  function getRecentQueryFromRow(target: EventTarget | null): QueryHistoryItem | undefined {
    const rowElement = target instanceof HTMLElement ? target.closest<HTMLLIElement>('[role="option"]') : null;
    if (!rowElement?.parentElement) {
      return undefined;
    }
    // `List` renders exactly one option per item, in item order, so a row's DOM position is its index
    const rowIndex = Array.prototype.indexOf.call(rowElement.parentElement.children, rowElement);
    return queryHistory[rowIndex];
  }

  /**
   * Plain click / Enter / Space on a recent query only loads it into the editor (`List` -> `onSelected`).
   * A modifier (Cmd/Ctrl) additionally executes it and Shift additionally restores it, for mouse and
   * keyboard alike. `List` neither exposes the triggering event nor lets Enter bubble past the list, so
   * both variants are intercepted in the capture phase on the wrapper around it.
   */
  function handleRecentQueryModifierAction(event: React.MouseEvent | React.KeyboardEvent) {
    const query = getRecentQueryFromRow(event.target);
    if (!query) {
      return;
    }
    // The shared helpers only read the modifier flags, which mouse and keyboard events share
    const modifierEvent = event as React.KeyboardEvent;
    if (hasModifierKey(modifierEvent)) {
      event.stopPropagation();
      selectRecentQuery(query);
      handleExecute(query.soql, query.isTooling);
      trackEvent(ANALYTICS_KEYS.quick_query_Execute, { method: 'keyboard', location: 'recent_query' });
    } else if (hasShiftModifierKey(modifierEvent)) {
      event.stopPropagation();
      selectRecentQuery(query);
      handleRestore(query.soql, query.isTooling);
      trackEvent(ANALYTICS_KEYS.quick_query_Restore, { method: 'keyboard', location: 'recent_query' });
    }
  }

  // ArrowDown from the last control above the list lands on the active (else first) recent query
  function handleViewAllHistoryKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (isArrowDownKey(event)) {
      event.preventDefault();
      focusListEntryRow(recentQueriesListRef.current);
    }
  }

  const handleExecuteRef = useRef(handleExecute);
  // eslint-disable-next-line react-hooks/refs
  handleExecuteRef.current = handleExecute;

  const setSoqlRef = useRef(setSoql);
  // eslint-disable-next-line react-hooks/refs
  setSoqlRef.current = setSoql;

  const soqlQueryFormatOptionsRef = useRef(soqlQueryFormatOptions);
  // eslint-disable-next-line react-hooks/refs
  soqlQueryFormatOptionsRef.current = soqlQueryFormatOptions;

  const handleEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    currEditor.focus();

    addDisposable(sanitizePastedEditorText(currEditor));

    const modelRange = currEditor.getModel()?.getFullModelRange();
    modelRange && currEditor.setSelection(modelRange);

    addDisposable(
      editorRef.current.addAction({
        id: 'modifier-enter',
        label: 'Submit',
        keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
        run: () => {
          handleExecuteRef.current(currEditor.getValue());
          trackEvent(ANALYTICS_KEYS.quick_query_Execute, { method: 'keyboard', location: 'editor' });
        },
      }),
    );
    addDisposable(
      editorRef.current.addAction({
        id: 'format',
        label: 'Format',
        keybindings: [monaco?.KeyMod.Shift | monaco?.KeyMod.Alt | monaco?.KeyCode.KeyF],
        contextMenuGroupId: '9_cutcopypaste',
        run: (currEditor) => {
          setSoqlRef.current(formatQuery(currEditor.getValue(), soqlQueryFormatOptionsRef.current));
          trackEvent(ANALYTICS_KEYS.quick_query_Format, { method: 'editor-shortcut' });
        },
      }),
    );
  };

  const isDisabled = !queryIsValid || isRestoring;

  async function handleSaveSoqlQueryFormatOptions(options: SoqlQueryFormatOptions): Promise<void> {
    setSoqlQueryFormatOptions(options);
    setSoql(formatQuery(soql, options));
    fromJetstreamEvents.emit({ type: 'saveSoqlQueryFormatOptions', payload: { value: options } });
  }

  if (!selectedOrg?.uniqueId || !!selectedOrg.connectionError) {
    return null;
  }

  return (
    <>
      {queryHistoryModalOpen && (
        <QueryHistoryModal selectedOrg={selectedOrg} onRestore={() => navigate('/query')} onclose={() => setQueryHistoryModalOpen(false)} />
      )}
      <Popover
        ref={popoverRef}
        size="x-large"
        header={
          <header className="slds-popover__header slds-grid">
            <h2 className="slds-text-heading_small">Query Records</h2>
            <KeyboardShortcut className="slds-m-left_x-small" keys={[getModifierKey(), 'e']} />
          </header>
        }
        content={
          <div className="slds-grid slds-gutters_small">
            {isRestoring && <Spinner />}
            <div className="slds-col slds-size_1-of-2">
              {!!queryHistory?.length && (
                <Fragment>
                  <Grid className="slds-m-bottom_x-small" align="spread">
                    <Grid verticalAlign="center">
                      <h2 className="slds-text-heading_small slds-grow">Recent Queries</h2>
                      <Tooltip
                        // The shortcuts are only documented here, so keyboard users need to be able to reach it
                        triggerTabIndex={0}
                        content={
                          <>
                            <p>Keyboard shortcuts:</p>
                            <Grid className="slds-m-vertical_small" verticalAlign="center">
                              <KeyboardShortcut inverse keys={[getModifierKey(), 'click']} />
                              <span className="slds-m-right_x-small">or</span>
                              <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                              to execute
                            </Grid>
                            <Grid verticalAlign="center">
                              <KeyboardShortcut inverse keys={['shift', 'click']} />
                              <span className="slds-m-right_x-small">or</span>
                              <KeyboardShortcut inverse keys={['shift', 'enter']} />
                              to restore
                            </Grid>
                          </>
                        }
                      >
                        <Icon
                          icon="info"
                          type="utility"
                          containerClassname="slds-icon_container slds-icon-utility-info slds-m-left_x-small"
                          className="slds-icon slds-icon-text-default slds-icon_x-small"
                        />
                      </Tooltip>
                    </Grid>
                    <button
                      className="slds-button slds-button_reset slds-text-link"
                      onClick={handleOpenQueryHistory}
                      onKeyDown={handleViewAllHistoryKeyDown}
                      title="View all query history"
                    >
                      View All History
                    </button>
                  </Grid>
                  <div
                    style={{ maxHeight: '450px', overflowY: 'auto' }}
                    onClickCapture={handleRecentQueryModifierAction}
                    onKeyDownCapture={(event) => {
                      if (isEnterKey(event)) {
                        handleRecentQueryModifierAction(event);
                      }
                    }}
                  >
                    <List
                      ref={recentQueriesListRef}
                      ariaLabel="Recent queries"
                      className="cursor-pointer"
                      items={queryHistory}
                      isActive={(query: QueryHistoryItem) => query.soql === soql}
                      getContent={(query: QueryHistoryItem) => ({
                        key: query.key,
                        heading: (
                          <div
                            className="slds-text-body_small"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.25rem',
                            }}
                            title={query.soql}
                          >
                            {query.soql}
                          </div>
                        ),
                        subheading: `${query.label || query.sObject}${query.isTooling ? ' (Metadata Query)' : ''}`,
                      })}
                      onSelected={(key) => {
                        const query = queryHistory.find((item) => item.key === key);
                        if (query) {
                          selectRecentQuery(query);
                        }
                      }}
                    />
                  </div>
                </Fragment>
              )}
            </div>
            <div className="slds-col slds-size_1-of-2">
              <Textarea
                id="soql-search"
                label={
                  <Grid align="spread">
                    <div className="slds-m-right_x-small">
                      <span>SOQL Query</span>
                    </div>
                    <span>
                      <button
                        className="slds-button slds-text-link_reset slds-text-link"
                        title="Format soql query"
                        disabled={!queryIsValid}
                        onClick={() => {
                          handleFormat();
                          trackEvent(ANALYTICS_KEYS.quick_query_Format, { method: 'popover' });
                        }}
                      >
                        format
                      </button>
                      <SoqlQueryFormatConfigPopover
                        location="QuickQueryPopover"
                        value={soqlQueryFormatOptions}
                        onChange={handleSaveSoqlQueryFormatOptions}
                      />
                    </span>
                  </Grid>
                }
              >
                <MonacoEditor
                  height="400px"
                  language="soql"
                  value={soql}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'off',
                    glyphMargin: false,
                    folding: false,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                    // Tab leaves the editor instead of inserting one: nobody indents SOQL in this compact
                    // popover, and without it keyboard users had no way out of Monaco
                    tabFocusMode: true,
                  }}
                  onMount={handleEditorMount}
                  onChange={(value) => setSoql(value || '')}
                />
              </Textarea>
              <Grid className="slds-m-top_xx-small">
                <GridCol extraProps={{ dir: 'rtl' }} bump="left">
                  <CheckboxToggle
                    id="is-tooling-query-search"
                    label="Query Type"
                    onText="Metadata Query"
                    offText="Object Query"
                    hideLabel
                    checked={isTooling}
                    onChange={setIsTooling}
                  />
                </GridCol>
              </Grid>
            </div>
          </div>
        }
        footer={
          <footer className="slds-popover__footer">
            <Grid verticalAlign="center">
              <GridCol bump="left">
                <button
                  className="slds-button slds-button_neutral slds-m-right_x-small"
                  disabled={!queryIsValid || isRestoring}
                  onClick={() => handleRestore()}
                >
                  <Icon type="utility" icon="task" className="slds-button__icon slds-button__icon_left" />
                  Restore
                </button>

                <button className="slds-button slds-button_brand" disabled={isDisabled} onClick={() => handleExecute()}>
                  <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
                  Execute
                </button>
              </GridCol>
            </Grid>
          </footer>
        }
        buttonProps={{
          className:
            'slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action cursor-pointer',
          // The shortcut is conveyed by aria-keyshortcuts below; repeating it in the name doubled the announcement
          title: 'Query Search',
          'aria-keyshortcuts': getAriaKeyshortcuts([getModifierKey(), 'e']),
          disabled: !selectedOrg || !!selectedOrg.connectionError,
          onClick: () => {
            trackEvent(ANALYTICS_KEYS.quick_query_Open, { method: 'keyboard' });
          },
        }}
      >
        <Icon type="utility" icon="search" className="slds-button__icon slds-global-header__icon" omitContainer />
      </Popover>
    </>
  );
};
