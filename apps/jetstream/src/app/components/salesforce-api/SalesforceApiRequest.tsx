/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { HTTP, INDEXED_DB, MIME_TYPES } from '@jetstream/shared/constants';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { HttpMethod, MapOf, SalesforceApiHistoryItem, SalesforceApiHistoryRequest, SalesforceOrgUi } from '@jetstream/types';
import { Card, Grid, HelpText, Icon, RadioButton, RadioGroup, Tooltip } from '@jetstream/ui';
import Editor, { OnMount } from '@monaco-editor/react';
import localforage from 'localforage';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useReducer, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromSalesforceApiHistory from './salesforceApi.state';
import SalesforceApiHistory from './SalesforceApiHistory';
import SalesforceApiUserInput from './SalesforceApiUserInput';

type JsonText = 'JSON' | 'TEXT';
type Action =
  | { type: 'HEADER_CHANGE'; payload: { value: string } }
  | { type: 'BODY_CHANGE'; payload: { method: HttpMethod; value: string; bodyType: JsonText } };
interface State {
  headersErrorMessage?: string;
  bodyErrorMessage?: string;
}

const DEFAULT_HEADERS = { [HTTP.HEADERS.CONTENT_TYPE]: MIME_TYPES.JSON, 'X-PrettyPrint': '1' };
const DEFAULT_BODY = `{\n\t\n}`;

let _priorRequest: {
  url: string;
  method: HttpMethod;
  headers: string;
  body: string;
  bodyType: JsonText;
};

function getDefaultUrl(org: SalesforceOrgUi, defaultApiVersion: string) {
  return `/services/data/${defaultApiVersion}/`;
}

function errorMessageReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HEADER_CHANGE': {
      try {
        JSON.parse(action.payload.value);
        return { ...state, headersErrorMessage: undefined };
      } catch (ex) {
        return { ...state, headersErrorMessage: ex.message };
      }
    }
    case 'BODY_CHANGE': {
      if (action.payload.method !== 'GET' && action.payload.bodyType === 'JSON' && action.payload.value) {
        try {
          JSON.parse(action.payload.value);
          return { ...state, bodyErrorMessage: undefined };
        } catch (ex) {
          return { ...state, bodyErrorMessage: ex.message };
        }
      }
      return { ...state, bodyErrorMessage: undefined };
    }
    default:
      return { ...state };
  }
}

export interface SalesforceApiRequestProps {
  loading: boolean;
  defaultApiVersion: string;
  selectedOrg: SalesforceOrgUi;
  onSubmit: (request: SalesforceApiHistoryRequest) => void;
}

export const SalesforceApiRequest: FunctionComponent<SalesforceApiRequestProps> = ({
  loading,
  defaultApiVersion,
  selectedOrg,
  onSubmit,
}) => {
  const headerRef = useRef<editor.IStandaloneCodeEditor>(null);
  const bodyRef = useRef<editor.IStandaloneCodeEditor>(null);
  const [url, setUrl] = useState(() => getDefaultUrl(selectedOrg, defaultApiVersion));
  const [method, setMethod] = useState<HttpMethod>(_priorRequest?.method || 'GET');
  const [headers, setHeaders] = useState(() => _priorRequest?.headers || JSON.stringify(DEFAULT_HEADERS, null, 2));
  const [body, setBody] = useState(() => _priorRequest?.body || DEFAULT_BODY);
  const [{ headersErrorMessage, bodyErrorMessage }, dispatch] = useReducer(errorMessageReducer, {});
  const [bodyType, setBodyType] = useState<JsonText>(_priorRequest?.bodyType || 'JSON');
  const historyItems = useRecoilValue(fromSalesforceApiHistory.salesforceApiHistoryState);

  const debouncedUrl = useDebounce(url, 300);
  const debouncedHeaders = useDebounce(headers, 300);
  const debouncedBody = useDebounce(body, 300);

  useNonInitialEffect(() => {
    (async () => {
      try {
        await localforage.setItem<MapOf<SalesforceApiHistoryItem>>(INDEXED_DB.KEYS.salesforceApiHistory, historyItems);
      } catch (ex) {
        logger.warn(ex);
      }
    })();
  }, [historyItems]);

  useNonInitialEffect(() => {
    dispatch({ type: 'HEADER_CHANGE', payload: { value: debouncedHeaders } });
  }, [debouncedHeaders]);

  useNonInitialEffect(() => {
    dispatch({ type: 'BODY_CHANGE', payload: { value: debouncedBody, bodyType, method } });
  }, [bodyType, debouncedBody, method]);

  useNonInitialEffect(() => {
    _priorRequest = {
      url: debouncedUrl,
      method: method,
      headers: debouncedHeaders,
      body: debouncedBody,
      bodyType: bodyType,
    };
  }, [debouncedUrl, debouncedHeaders, debouncedBody, method, bodyType]);

  function handleSubmit(values?: { headers: string; body: string }) {
    if (!loading && !headersErrorMessage && !bodyErrorMessage) {
      values = values || { headers, body };
      try {
        onSubmit({ url, method, headers: JSON.parse(values.headers) || {}, body: method === 'GET' ? '' : values.body, bodyType });
      } catch (ex) {
        // This should not happen as we check for valid headers prior to getting here
      }
    }
  }

  function handleRestoreFromHistory(request: SalesforceApiHistoryRequest) {
    setUrl(request.url);
    setMethod(request.method);
    setHeaders(JSON.stringify(request.headers, null, 2));
    setBody(request.body);
    setBodyType(request.bodyType);
  }

  const handleHeaderEditorMount: OnMount = (currEditor, monaco) => {
    headerRef.current = currEditor;
    headerRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
      run: (currEditor) => {
        handleSubmit({ headers: currEditor.getValue(), body });
      },
    });
  };

  const handleBodyEditorMount: OnMount = (currEditor, monaco) => {
    bodyRef.current = currEditor;
    bodyRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
      run: (currEditor) => {
        setBody(currEditor.getValue());
        handleSubmit({ headers, body: currEditor.getValue() });
      },
    });
  };

  return (
    <Card
      title="Salesforce API Request"
      actions={
        <Grid>
          <SalesforceApiHistory className="slds-col" disabled={loading} onHistorySelected={handleRestoreFromHistory} />
          <button
            className="slds-button slds-button_brand"
            onClick={() => handleSubmit()}
            title="alt/cmd + enter"
            disabled={loading || !!headersErrorMessage || !!bodyErrorMessage}
          >
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
          onAltEnter={handleSubmit}
        />
        <Grid verticalAlign="end" className="slds-m-top_x-small">
          <h2 className="slds-text-heading_small">Request Headers</h2>
          {headersErrorMessage && (
            <Tooltip id="headers-error" content="The headers must be valid JSON to submit your request">
              <Icon type="utility" icon="error" className="slds-icon slds-icon_xx-small slds-m-left_xx-small slds-icon-text-error" />
            </Tooltip>
          )}
        </Grid>
        <Editor
          height="150px"
          theme="vs-dark"
          language="json"
          value={headers}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
          onMount={handleHeaderEditorMount}
          onChange={(value) => setHeaders(value)}
        />
        <Grid
          verticalAlign="end"
          className="slds-m-top_x-small"
          css={css`
            min-height: 33px;
          `}
        >
          <h2 className="slds-text-heading_small">Request Body</h2>
          <HelpText
            id="requestHelp"
            className="slds-m-bottom_xx-small slds-m-left_xx-small"
            content={`If you need to include the Session Id in the body of the request, for example with SOAP requests, add the text "{sessionId}" in the request, which will be replaced with the session id.`}
          />
          {method === 'GET' && <span className="slds-col_bump-left">Body is not allowed for GET requests</span>}
          {bodyErrorMessage && (
            <Tooltip id="headers-error" content="The body must be valid JSON to submit your request">
              <Icon type="utility" icon="error" className="slds-icon slds-icon_xx-small slds-m-left_xx-small slds-icon-text-error" />
            </Tooltip>
          )}
          {method !== 'GET' && (
            <RadioGroup className="slds-col_bump-left" isButtonGroup>
              <RadioButton
                name="bodyType"
                label="JSON"
                value="JSON"
                disabled={loading}
                checked={bodyType === 'JSON'}
                onChange={(value: JsonText) => setBodyType(value)}
              />
              <RadioButton
                name="bodyType"
                label="Text"
                value="TEXT"
                disabled={loading}
                checked={bodyType === 'TEXT'}
                onChange={(value: JsonText) => setBodyType(value)}
              />
            </RadioGroup>
          )}
        </Grid>
        <div className="slds-is-relative">
          <div
            css={css`
              position: absolute;
              width: 100%;
              height: 100%;
              background-color: green;
            `}
          />
          <Editor
            height="60vh"
            theme="vs-dark"
            language={bodyType === 'TEXT' ? 'plaintext' : 'json'}
            value={body}
            options={{
              readOnly: method === 'GET',
            }}
            onMount={handleBodyEditorMount}
            onChange={(value) => setBody(value)}
          />
        </div>
      </div>
    </Card>
  );
};

export default SalesforceApiRequest;
