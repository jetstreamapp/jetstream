/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, INDEXED_DB } from '@jetstream/shared/constants';
import { anonymousApex } from '@jetstream/shared/data';
import { useDebounce, useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { ApexHistoryItem, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Badge, Card, CodeEditor, CopyToClipboard, Grid, Icon, Spinner } from '@jetstream/ui';
import localforage from 'localforage';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState, STORAGE_KEYS } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import AnonymousApexHistory from './AnonymousApexHistory';
import * as fromApexState from './apex.state';
import { useApexCompletions } from './useApexCompletions';
require('codemirror/theme/monokai.css');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AnonymousApexProps {}

export const AnonymousApex: FunctionComponent<AnonymousApexProps> = () => {
  const isMounted = useRef(null);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [apex, setApex] = useState(() => localStorage.getItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY) || '');
  const [results, setResults] = useState('');
  const [resultsStatus, setResultsStatus] = useState({ hasResults: false, success: false, label: null });
  const [loading, setLoading] = useState(false);
  const [historyItems, setHistoryItems] = useRecoilState(fromApexState.apexHistoryState);
  const debouncedApex = useDebounce(apex, 1000);
  const { hint } = useApexCompletions(selectedOrg);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useNonInitialEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY, debouncedApex);
  }, [debouncedApex]);

  useNonInitialEffect(() => {
    if (apex) {
      (async () => {
        try {
          await localforage.setItem<MapOf<ApexHistoryItem>>(INDEXED_DB.KEYS.apexHistory, historyItems);
        } catch (ex) {
          logger.warn(ex);
        }
      })();
    }
  }, [historyItems]);

  const onSubmit = useCallback(async () => {
    setLoading(true);
    setResults('');
    setResultsStatus({ hasResults: false, success: false, label: null });
    try {
      const { result, debugLog } = await anonymousApex(selectedOrg, apex);
      if (!result.success) {
        let summary = '';
        summary += `line ${result.line}, column ${result.column}\n`;
        summary += result.compileProblem ? `${result.compileProblem}\n` : '';
        summary += result.exceptionMessage ? `${result.exceptionMessage}\n` : '';
        summary += result.exceptionStackTrace ? `${result.exceptionStackTrace}\n` : '';
        if (debugLog) {
          summary += `\n${debugLog}`;
        }
        setResults(summary);
        setResultsStatus({ hasResults: true, success: false, label: result.compileProblem ? 'Compile Error' : 'Runtime Error' });
      } else {
        setResults(debugLog);
        setResultsStatus({ hasResults: true, success: true, label: 'Success' });
        fromApexState
          .initNewApexHistoryItem(selectedOrg, apex)
          .then((updatedHistoryItems) => {
            setHistoryItems(updatedHistoryItems);
          })
          .catch((ex) => {
            logger.warn('[ERROR] Could not save history', ex);
            rollbar.error('Error saving apex history', ex);
          });
      }
      trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: result.success });
    } catch (ex) {
      setResults(`There was a problem submitting the request\n${ex.message}`);
      trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: false });
    } finally {
      setLoading(false);
    }
  }, [apex, historyItems, selectedOrg, setHistoryItems, trackEvent]);

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} setHeightAttr className="slds-p-horizontal_x-small slds-scrollable_none">
      <Split
        sizes={[50, 50]}
        minSize={[300, 300]}
        gutterSize={10}
        className="slds-gutters"
        css={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <div className="slds-p-horizontal_x-small">
          <Card
            title="Anonymous Apex"
            actions={
              <Grid>
                <AnonymousApexHistory className="slds-col" onHistorySelected={setApex} />
                <button className="slds-button slds-button_brand" onClick={onSubmit}>
                  <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Submit
                </button>
              </Grid>
            }
          >
            <CodeEditor
              className="CodeMirror-full-height CodeMirror-textarea"
              value={apex}
              lineNumbers
              size={{ height: '80vh' }}
              options={{
                mode: 'text/x-java',
                theme: 'monokai',
                matchBrackets: true,
                autoCloseBrackets: true,
                showCursorWhenSelecting: true,
                extraKeys: {
                  'Ctrl-Space': 'autocomplete',
                  'Alt-Enter': onSubmit,
                  'Meta-Enter': onSubmit,
                },
                highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
                hintOptions: { hint, completeSingle: false },
              }}
              onChange={setApex}
            />
          </Card>
        </div>
        <div className="slds-p-horizontal_x-small slds-is-relative">
          <Card
            title={
              <div>
                Results
                {resultsStatus.hasResults && (
                  <span className="slds-m-left_small">
                    <Badge type={resultsStatus.success ? 'success' : 'error'}>
                      <span className="slds-badge__icon slds-badge__icon_left slds-badge__icon_inverse">
                        <Icon
                          type="utility"
                          icon={resultsStatus.success ? 'success' : 'error'}
                          containerClassname="slds-icon_container slds-current-color"
                          className="slds-icon slds-icon_xx-small"
                        />
                      </span>
                      {resultsStatus.label}
                    </Badge>
                  </span>
                )}
              </div>
            }
            actions={<CopyToClipboard type="button" content={results} disabled={!results} />}
          >
            {loading && <Spinner />}
            <CodeEditor
              className="CodeMirror-full-height CodeMirror-textarea"
              value={results}
              size={{ height: '80vh' }}
              options={{
                mode: 'text',
                highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
                readOnly: results ? true : 'nocursor',
              }}
            />
          </Card>
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default AnonymousApex;
