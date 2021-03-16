/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { HTTP, MIME_TYPES } from '@jetstream/shared/constants';
import { HttpMethod, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Card, CodeEditor, CopyToClipboard, Grid, Icon, Spinner } from '@jetstream/ui';
import { useHeaderCompletions } from './useHeaderCompletions';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
// import * as fromSalesforceApiState from './salesforceApi.state';
import SalesforceApiUserInput from './SalesforceApiUserInput';
require('codemirror/theme/monokai.css');
// TODO: need to install json-lint for this to work
// view-source:https://codemirror.net/demo/lint.html
// require('codemirror/addon/lint/lint');
// require('codemirror/addon/lint/json-lint');
// require('codemirror/addon/lint/lint.css');

const DEFAULT_HEADERS = { [HTTP.HEADERS.CONTENT_TYPE]: MIME_TYPES.JSON, [HTTP.HEADERS.ACCEPT]: 'application/json', 'X-PrettyPrint': 1 };
const DEFAULT_BODY = `{\n\t\n}`;

function getDefaultUrl(org: SalesforceOrgUi, defaultApiVersion: string) {
  return `/services/${defaultApiVersion}`;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SalesforceApiProps {}

export const SalesforceApi: FunctionComponent<SalesforceApiProps> = () => {
  const isMounted = useRef(null);
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [url, setUrl] = useState(() => getDefaultUrl(selectedOrg, defaultApiVersion));
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [headers, setHeaders] = useState(() => JSON.stringify(DEFAULT_HEADERS, null, 2));
  const [body, setBody] = useState(() => DEFAULT_BODY);
  const [results, setResults] = useState('');
  const [loading, setLoading] = useState(false);
  // const [historyItems, setHistoryItems] = useRecoilState(fromApexState.apexHistoryState);
  // const debouncedApex = useDebounce(apex, 1000);

  const { hint } = useHeaderCompletions();

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // useNonInitialEffect(() => {
  //   localStorage.setItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY, debouncedApex);
  // }, [debouncedApex]);

  // useNonInitialEffect(() => {
  //   if (apex) {
  //     (async () => {
  //       try {
  //         await localforage.setItem<MapOf<ApexHistoryItem>>(INDEXED_DB.KEYS.apexHistory, historyItems);
  //       } catch (ex) {
  //         logger.warn(ex);
  //       }
  //     })();
  //   }
  // }, [historyItems]);

  const onSubmit = useCallback(async () => {
    // setLoading(true);
    // setResults('');
    // try {
    //   const results = await salesforceApi(selectedOrg, apex);
    //   if (!results.result.success) {
    //     let summary = `There was a problem running your code.\n`;
    //     summary += `line ${results.result.line} column ${results.result.column}\n`;
    //     summary += results.result.compileProblem ? `${results.result.compileProblem}\n` : '';
    //     summary += results.result.exceptionMessage ? `${results.result.exceptionMessage}\n` : '';
    //     summary += results.result.exceptionStackTrace ? `${results.result.compileProblem}\n` : '';
    //     setResults(summary);
    //   } else {
    //     setResults(results.debugLog);
    //     const newItem = fromApexState.getApexHistoryItem(selectedOrg, apex);
    //     setHistoryItems({ [newItem.key]: newItem, ...historyItems });
    //   }
    //   trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: results.result.success });
    // } catch (ex) {
    //   setResults('There was a problem submitting the request');
    //   trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: false });
    // } finally {
    //   setLoading(false);
    // }
  }, []);

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
                {/* <SalesforceApiHistory className="slds-col" onHistorySelected={setApex} /> */}
                <button className="slds-button slds-button_brand" onClick={onSubmit}>
                  <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Submit
                </button>
              </Grid>
            }
          >
            <div>
              <SalesforceApiUserInput
                selectedOrg={selectedOrg}
                url={url}
                method={method}
                loading={loading}
                onUrlChange={setUrl}
                onMethodChange={setMethod}
              />
              <h2 className="slds-text-heading_small">Headers</h2>
              <CodeEditor
                className="CodeMirror-full-height CodeMirror-textarea"
                value={headers}
                lineNumbers
                size={{ height: `150px` }}
                options={{
                  mode: { name: 'javascript', json: true },
                  tabSize: 2,
                  gutters: ['CodeMirror-lint-markers'],
                  lint: true,
                  theme: 'monokai',
                  matchBrackets: true,
                  autoCloseBrackets: true,
                  showCursorWhenSelecting: true,
                  extraKeys: {
                    'Ctrl-Space': 'autocomplete',
                    'Alt-Enter': onSubmit,
                    'Meta-Enter': onSubmit,
                  },
                  hintOptions: { hint, completeSingle: false },
                }}
                onChange={setHeaders}
              />
              <h2 className="slds-text-heading_small">Body</h2>
              <CodeEditor
                className="CodeMirror-full-height CodeMirror-textarea"
                value={body}
                lineNumbers
                size={{ height: '60vh' }}
                options={{
                  mode: { name: 'javascript', json: true },
                  tabSize: 2,
                  gutters: ['CodeMirror-lint-markers'],
                  lint: true,
                  theme: 'monokai',
                  matchBrackets: true,
                  autoCloseBrackets: true,
                  showCursorWhenSelecting: true,
                  extraKeys: {
                    'Alt-Enter': onSubmit,
                    'Meta-Enter': onSubmit,
                  },
                }}
                onChange={setBody}
              />
            </div>
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
                mode: { name: 'javascript', json: true },
                readOnly: true,
              }}
            />
          </Card>
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default SalesforceApi;
