/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { ManualRequestResponse } from '@jetstream/types';
import { Card, CodeEditor, CopyToClipboard, Grid, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';

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
      <CodeEditor
        className="CodeMirror-full-height CodeMirror-textarea"
        value={results?.headers}
        lineNumbers
        size={{ height: `150px` }}
        options={{
          mode: { name: 'javascript', json: true },
          readOnly: true,
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
      <CodeEditor
        className="CodeMirror-full-height CodeMirror-textarea"
        value={results?.body}
        lineNumbers
        size={{ height: '60vh' }}
        options={{
          mode: { name: 'javascript', json: true },
          readOnly: true,
        }}
      />
    </Card>
  );
};

export default SalesforceApiResponse;
