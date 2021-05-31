/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { ManualRequestResponse } from '@jetstream/types';
import { Card, CopyToClipboard, Grid, Spinner } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

export interface SalesforceApiResponseProps {
  loading: boolean;
  results: ManualRequestResponse;
}

export const SalesforceApiResponse: FunctionComponent<SalesforceApiResponseProps> = ({ loading, results }) => {
  return (
    <Card title="Response" actions={<CopyToClipboard type="button" content={results?.body} disabled={!results} />}>
      {loading && <Spinner />}
      <Grid
        vertical
        css={css`
          min-height: 56px;
        `}
      >
        {results?.status && (
          <div>
            Status:{' '}
            <span
              className={classNames({
                'slds-text-color_success': results.status >= 200 && results.status <= 299,
                'slds-text-color_error': results.status < 200 || results.status > 299,
              })}
            >
              {results?.status} {results?.statusText}
            </span>
          </div>
        )}
        <div
          className="slds-text-color_error"
          title={results?.errorMessage}
          css={css`
            white-space: nowrap;
            overflow-x: auto;
            max-width: 100%;
          `}
        >
          {results?.errorMessage}
        </div>
      </Grid>
      <h2 className="slds-text-heading_small slds-m-top_x-small">Response Headers</h2>
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
        <h2 className="slds-text-heading_small">Response Body</h2>
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

export default SalesforceApiResponse;
