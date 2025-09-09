import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { hasModifierKey, hasShiftModifierKey, isEKey, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { QueryHistoryItem } from '@jetstream/types';
import {
  CheckboxToggle,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  Popover,
  PopoverRef,
  Spinner,
  Textarea,
  Tooltip,
  getModifierKey,
} from '@jetstream/ui';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { dexieDb } from '@jetstream/ui/db';
import { formatQuery, isQueryValid } from '@jetstreamapp/soql-parser-js';
import Editor, { OnMount } from '@monaco-editor/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import type { editor } from 'monaco-editor';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAmplitude } from '../analytics';
import { QueryHistoryModal } from './QueryHistory/QueryHistoryModal';
import { useQueryRestore } from './RestoreQuery/useQueryRestore';

const NUM_HISTORY_ITEMS = 50;

export const QuickQueryPopover = () => {
  const { trackEvent } = useAmplitude();
  const popoverRef = useRef<PopoverRef>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);

  const [soql, setSoql] = useState<string>('');
  const [queryIsValid, setQueryIsValid] = useState(false);
  const [isTooling, setIsTooling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [queryHistoryModalOpen, setQueryHistoryModalOpen] = useState(false);

  const [restore, errorMessage] = useQueryRestore(soql, isTooling, {
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
    () => dexieDb.query_history.orderBy('lastRun').reverse().limit(NUM_HISTORY_ITEMS).toArray(),
    [],
    [] as QueryHistoryItem[],
  );

  useEffect(() => {
    setQueryIsValid(!!soql && isQueryValid(soql));
  }, [soql]);

  const onKeydown = useCallback((event: KeyboardEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (hasModifierKey(event as any) && isEKey(event as any)) {
      event.stopPropagation();
      event.preventDefault();
      popoverRef.current?.open();
      trackEvent(ANALYTICS_KEYS.quick_query_Open, { method: 'keyboard' });
    }
  }, []);

  useGlobalEventHandler('keydown', onKeydown);

  function handleFormat() {
    setSoql(formatQuery(soql, { fieldMaxLineLength: 80 }));
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

  function handleSelectRecentQuery(event: React.MouseEvent, query: QueryHistoryItem) {
    event.stopPropagation();
    setSoql(query.soql);
    setIsTooling(query.isTooling);
    if (hasModifierKey(event as any)) {
      handleExecute(query.soql, query.isTooling);
      trackEvent(ANALYTICS_KEYS.quick_query_Execute, { method: 'keyboard', location: 'recent_query' });
    } else if (hasShiftModifierKey(event as any)) {
      handleRestore(query.soql, query.isTooling);
      trackEvent(ANALYTICS_KEYS.quick_query_Restore, { method: 'keyboard', location: 'recent_query' });
    }
  }

  const handleEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    currEditor.focus();

    const modelRange = currEditor.getModel()?.getFullModelRange();
    modelRange && currEditor.setSelection(modelRange);

    editorRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
      run: () => {
        handleExecute(currEditor.getValue());
        trackEvent(ANALYTICS_KEYS.quick_query_Execute, { method: 'keyboard', location: 'editor' });
      },
    });
    editorRef.current.addAction({
      id: 'format',
      label: 'Format',
      keybindings: [monaco?.KeyMod.Shift | monaco?.KeyMod.Alt | monaco?.KeyCode.KeyF],
      contextMenuGroupId: '9_cutcopypaste',
      run: (currEditor) => {
        setSoql(formatQuery(currEditor.getValue(), { fieldMaxLineLength: 80 }));
        trackEvent(ANALYTICS_KEYS.quick_query_Format, { method: 'editor-shortcut' });
      },
    });
  };

  const isDisabled = !queryIsValid || isRestoring;

  if (!selectedOrg || !!selectedOrg.connectionError) {
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
                        content={
                          <>
                            <p>Keyboard shortcuts:</p>
                            <Grid className="slds-m-vertical_small">
                              <KeyboardShortcut inverse keys={[getModifierKey(), 'click']} />
                              to execute
                            </Grid>
                            <Grid>
                              <KeyboardShortcut inverse keys={['shift', 'click']} />
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
                      title="View all query history"
                    >
                      View All History
                    </button>
                  </Grid>
                  <ul className="slds-has-dividers_top-space" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    {queryHistory.map((query) => (
                      <li
                        key={query.key}
                        className="slds-item slds-text-link cursor-pointer slds-p-around_small"
                        onClick={(event) => handleSelectRecentQuery(event, query)}
                        style={{ cursor: 'pointer' }}
                      >
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
                        <div className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
                          {query.label || query.sObject} {query.isTooling && '(Metadata Query)'}
                        </div>
                      </li>
                    ))}
                  </ul>
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
                    </span>
                  </Grid>
                }
              >
                <Editor
                  className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
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
          title: 'Query Search - ctrl/command + e',
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
