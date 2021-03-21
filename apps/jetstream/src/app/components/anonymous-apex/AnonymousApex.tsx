/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, INDEXED_DB } from '@jetstream/shared/constants';
import { anonymousApex } from '@jetstream/shared/data';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ApexHistoryItem, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Card, CodeEditor, CopyToClipboard, Grid, Icon, Spinner } from '@jetstream/ui';
import localforage from 'localforage';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState, STORAGE_KEYS } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import * as fromApexState from './apex.state';
import AnonymousApexHistory from './AnonymousApexHistory';
import { useApexCompletions } from './useApexCompletions';
require('codemirror/theme/monokai.css');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AnonymousApexProps {}

export const AnonymousApex: FunctionComponent<AnonymousApexProps> = () => {
  const isMounted = useRef(null);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [apex, setApex] = useState(() => localStorage.getItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY) || '');
  const [results, setResults] = useState('');
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
  }, [apex, historyItems]);

  const onSubmit = useCallback(async () => {
    setLoading(true);
    setResults('');
    try {
      const results = await anonymousApex(selectedOrg, apex);
      if (!results.result.success) {
        let summary = `There was a problem running your code.\n`;
        summary += `line ${results.result.line} column ${results.result.column}\n`;
        summary += results.result.compileProblem ? `${results.result.compileProblem}\n` : '';
        summary += results.result.exceptionMessage ? `${results.result.exceptionMessage}\n` : '';
        summary += results.result.exceptionStackTrace ? `${results.result.compileProblem}\n` : '';
        setResults(summary);
      } else {
        setResults(results.debugLog);
        const newItem = fromApexState.getApexHistoryItem(selectedOrg, apex);
        setHistoryItems({ ...historyItems, [newItem.key]: newItem });
      }
      trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: results.result.success });
    } catch (ex) {
      setResults('There was a problem submitting the request');
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
          <Card title="Results" actions={<CopyToClipboard type="button" content={results} disabled={!results} />}>
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
