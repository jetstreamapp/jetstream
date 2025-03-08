import { css } from '@emotion/react';
import { ManualRequestResponse, Maybe, SalesforceApiHistoryRequest } from '@jetstream/types';
import { Badge, Card, CopyToClipboard, Grid, Spinner } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import { FunctionComponent } from 'react';
import { getBadgeTypeFromMethod } from './salesforce-api.utils';

export interface SalesforceApiResponseProps {
  loading: boolean;
  request: Maybe<SalesforceApiHistoryRequest>;
  results: Maybe<ManualRequestResponse>;
}

export const SalesforceApiResponse: FunctionComponent<SalesforceApiResponseProps> = ({ loading, request, results }) => {
  return (
    <Card
      icon={{ type: 'standard', icon: 'outcome' }}
      title="Response"
      actions={
        results?.status && (
          <div>
            <Badge type={results.status >= 200 && results.status <= 299 ? 'success' : 'error'}>
              {results?.status} {results?.statusText}
            </Badge>
          </div>
        )
      }
    >
      {loading && <Spinner />}
      <Grid
        vertical
        css={css`
          min-height: 56px;
        `}
      >
        {request && (
          <div className="slds-m-top_xx-small slds-grid">
            <div>
              <Badge type={getBadgeTypeFromMethod(request.method)}>{request.method}</Badge>
            </div>
            <div>
              <CopyToClipboard content={request.url} className="slds-m-horizontal_xx-small" />
            </div>
            <span className="slds-line-clamp_large" title={request.url}>
              {request.url}
            </span>
          </div>
        )}
        <div
          className="slds-text-color_error"
          title={results?.errorMessage || undefined}
          css={css`
            white-space: nowrap;
            overflow-x: auto;
            max-width: 100%;
          `}
        >
          {results?.errorMessage}
        </div>
      </Grid>
      <h2 className="slds-text-heading_small slds-m-top_x-small">
        Response Headers
        {results?.headers && <CopyToClipboard content={results.headers} className="slds-m-horizontal_xx-small" />}
      </h2>
      <Editor
        height="150px"
        theme="vs-dark"
        language="json"
        value={results?.headers || ''}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
      <Grid
        verticalAlign="end"
        className="slds-m-top_x-small"
        css={css`
          min-height: 33px;
        `}
      >
        <h2 className="slds-text-heading_small">
          Response Body
          {results?.body && <CopyToClipboard content={results.body} className="slds-m-horizontal_xx-small" />}
        </h2>
      </Grid>
      <Editor
        height="60vh"
        theme="vs-dark"
        language="json"
        value={results?.body || ''}
        options={{
          readOnly: true,
          minimap: { enabled: false },
        }}
      />
    </Card>
  );
};
