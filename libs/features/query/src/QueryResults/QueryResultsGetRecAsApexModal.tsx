import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Field, FieldType, SalesforceOrgUi } from '@jetstream/types';
import { AxeIllustration, EmptyState, Grid, GridCol, Icon, Modal, Spinner } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import copyToClipboard from 'copy-to-clipboard';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { RecordToApexOptionsInitialOptions, recordToApex, recordsToApex } from '../utils/query-apex-utils';
import QueryResultsGetRecAsApexFieldOptions from './QueryResultsGetRecAsApexFieldOptions';
import QueryResultsGetRecAsApexGenerateOptions from './QueryResultsGetRecAsApexGenerateOptions';

export interface QueryResultsGetRecAsApexModalProps {
  org: SalesforceOrgUi;
  records: any[];
  sobjectName: string;
  onClose: () => void;
}

export const QueryResultsGetRecAsApexModal: FunctionComponent<QueryResultsGetRecAsApexModalProps> = ({
  org,
  records,
  sobjectName,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fieldMetadata, setFieldMetadata] = useState<Field[]>([]);
  const [fieldTypesByName, setFieldTypesByName] = useState<Record<string, FieldType>>({});
  const [fields, setFields] = useState<string[]>([]);
  const [options, setOptions] = useState<RecordToApexOptionsInitialOptions>({
    sobjectName,
    fieldMetadata: fieldTypesByName,
    fields,
  });
  const hasMultipleRecords = records.length > 1;
  const [apex, setApex] = useState<string>('');

  const fetchFieldMetadata = useCallback(async () => {
    try {
      setApex('');
      setLoading(true);
      setHasError(false);
      setFieldMetadata([]);
      setFieldTypesByName({});
      const metadata = await describeSObject(org, sobjectName);
      const fieldTypeByApiName = metadata.data.fields.reduce((output: Record<string, FieldType>, field) => {
        output[field.name] = field.type;
        return output;
      }, {});
      setLoading(false);
      setFieldMetadata(metadata.data.fields);
      setFieldTypesByName(fieldTypeByApiName);
    } catch (ex) {
      logger.warn('[FETCH METADATA ERROR]', ex);
      setLoading(true);
      setHasError(true);
    }
  }, [org, sobjectName]);

  useEffect(() => {
    fetchFieldMetadata();
  }, [fetchFieldMetadata, org, records, sobjectName]);

  useEffect(() => {
    setOptions((options) => ({ ...options, fieldMetadata: fieldTypesByName }));
  }, [fieldTypesByName]);

  useEffect(() => {
    setOptions((options) => ({ ...options, fields }));
  }, [fields]);

  useNonInitialEffect(() => {
    if (!loading && !hasError) {
      setApex(hasMultipleRecords ? recordsToApex(records, options) : recordToApex(records[0], options));
    }
  }, [hasError, hasMultipleRecords, loading, options, records]);

  const handleOptionsChange = useCallback((partialOptions: Partial<RecordToApexOptionsInitialOptions>) => {
    setOptions((options) => ({ ...options, ...partialOptions }));
  }, []);

  function handleCopyToClipboard() {
    copyToClipboard(apex, { format: 'text/plain' });
  }

  function handleEditorChange(value?: string, event?: unknown) {
    setApex(value || '');
  }

  return (
    <Modal
      header="Turn Record Into Apex"
      size="lg"
      footer={
        <Grid align="end">
          <button className="slds-button slds-button_brand" onClick={() => onClose()} disabled={loading}>
            Close
          </button>
        </Grid>
      }
      onClose={() => onClose()}
    >
      <div
        className="slds-is-relative"
        css={css`
          height: 80vh;
          min-height: 80vh;
          max-height: 80vh;
        `}
      >
        {loading && <Spinner />}
        {!loading && (
          <Grid
            css={css`
              height: 100%;
            `}
          >
            <GridCol size={4}>
              {/* Field Options */}
              <QueryResultsGetRecAsApexFieldOptions
                fieldMetadata={fieldMetadata}
                onFields={(fields) => setFields(fields)}
                onOptionsChange={handleOptionsChange}
              />
              {/* Generation Options */}
              <QueryResultsGetRecAsApexGenerateOptions isList={hasMultipleRecords} onChange={handleOptionsChange} />
              <hr className="slds-m-vertical_medium" />
              <button className="slds-button slds-button_neutral" onClick={handleCopyToClipboard} disabled={loading}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Copy to Clipboard
              </button>
            </GridCol>
            <GridCol
              css={css`
                height: 100%;
              `}
            >
              {fields.length > 0 && (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  defaultLanguage="apex"
                  value={apex}
                  options={{ contextmenu: false }}
                  onChange={handleEditorChange}
                />
              )}
              {fields.length === 0 && (
                <EmptyState
                  headline="There are no fields matching your selected options"
                  subHeading="Adjust your field options or your query to include additional fields."
                  illustration={<AxeIllustration />}
                ></EmptyState>
              )}
            </GridCol>
          </Grid>
        )}
      </div>
    </Modal>
  );
};

export default QueryResultsGetRecAsApexModal;
