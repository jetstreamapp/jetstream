import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage, pluralizeFromNumber } from '@jetstream/shared/utils';
import { Field, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { AssistiveStatus, FileDownloadModal, fireToast, Grid, GridCol, Icon, ScopedNotification, Spinner } from '@jetstream/ui';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import isNumber from 'lodash/isNumber';
import { Fragment, FunctionComponent, ReactNode, useEffect, useRef, useState } from 'react';
import { useAmplitude } from '../analytics';
import { fromJetstreamEvents } from '../jetstream-events';
import MassUpdateRecordTransformationText from './MassUpdateRecordTransformationText';
import MassUpdateRecordsObjectRowCriteria from './MassUpdateRecordsObjectRowCriteria';
import MassUpdateRecordsObjectRowField from './MassUpdateRecordsObjectRowField';
import MassUpdateRecordsObjectRowLimit from './MassUpdateRecordsObjectRowLimit';
import MassUpdateRecordsObjectRowValue from './MassUpdateRecordsObjectRowValue';
import { MetadataRow, MetadataRowConfiguration, TransformationOptions, ValidationResults } from './mass-update-records.types';
import { getFieldsToQuery, queryRecordsForRow } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowProps {
  org: SalesforceOrgUi;
  className?: string;
  sobject: string;
  loading: boolean;
  fields: ListItem[];
  valueFields: ListItem[];
  fieldConfigurations: MetadataRowConfiguration[];
  validationResults?: Maybe<ValidationResults>;
  hasExternalWhereClause?: boolean;
  /**
   * When provided, inputs to limit / skip records are shown. Omitted where the records to update are
   * already scoped by something else, such as the query results entry point.
   */
  recordLimit?: { limit: Maybe<number>; onChange: (limit: Maybe<number>) => void };
  disabled?: boolean;
  onFieldChange: (index: number, selectedField: string, fieldMetadata: Field) => void;
  onOptionsChange: (index: number, sobject: string, options: TransformationOptions) => void;
  /** Used if some options should not be included in criteria dropdown */
  filterCriteriaFn?: (item: ListItem) => boolean;
  onLoadChildFields?: (item: ListItem) => Promise<ListItem[]>;
  onAddField: (sobject: string) => void;
  onRemoveField: (sobject: string, configIndex: number) => void;
  children?: ReactNode;
}

export const MassUpdateRecordsObjectRow: FunctionComponent<MassUpdateRecordsObjectRowProps> = ({
  org,
  className,
  sobject,
  loading,
  fields,
  valueFields,
  fieldConfigurations,
  validationResults,
  hasExternalWhereClause,
  recordLimit,
  disabled,
  onFieldChange,
  onOptionsChange,
  filterCriteriaFn,
  onLoadChildFields,
  onAddField,
  onRemoveField,
  children,
}) => {
  const { trackEvent } = useAmplitude();
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const [downloadRecordsLoading, setDownloadRecordsLoading] = useState(false);
  const [downloadModalData, setDownloadModalData] = useState<{ open: boolean; data: any[]; header: string[]; fileNameParts: string[] }>({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
  });

  async function handleDownloadValidationRecords() {
    try {
      setDownloadRecordsLoading(true);
      const fieldsToQuery = getFieldsToQuery(fieldConfigurations);
      const row = { sobject, configuration: fieldConfigurations, limit: recordLimit?.limit } as MetadataRow;
      // Shares the deploy path's fetch so the previewed records are exactly the records that will be updated.
      // Custom criteria membership is skipped because the download shows the raw queried records.
      const { records } = await queryRecordsForRow(row, fieldsToQuery, org, { resolveCustomCriteria: false });

      setDownloadModalData({
        open: true,
        data: records,
        header: fieldsToQuery,
        fileNameParts: ['mass-update', sobject.toLowerCase(), 'validation-records'],
      });
      trackEvent(ANALYTICS_KEYS.mass_update_DownloadRecords, { type: 'validation', numRows: records.length });
    } catch (ex) {
      logger.error('[DOWNLOAD VALIDATION RECORDS]', ex);
      fireToast({ type: 'error', message: `Failed to download records. ${getErrorMessage(ex)}` });
    } finally {
      setDownloadRecordsLoading(false);
    }
  }

  function handleDownloadModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false });
  }

  // Rows are keyed by index, so the combobox at position i always carries this id — the focus
  // management below addresses rows directly instead of scraping the DOM for label text
  const fieldToUpdateComboboxId = (index: number) => `${sobject}-field-to-update-${index}`;

  /**
   * Focus the "Field to Update" combobox of `pendingFocusRowIndex` after the row list re-renders.
   * The parent owns fieldConfigurations, so the add/remove callbacks cannot focus synchronously —
   * this effect runs after the commit that applied the change, when the target row exists.
   */
  const pendingFocusRowIndex = useRef<number | null>(null);
  useEffect(() => {
    if (pendingFocusRowIndex.current === null) {
      return;
    }
    const rowIndex = Math.min(pendingFocusRowIndex.current, fieldConfigurations.length - 1);
    pendingFocusRowIndex.current = null;
    document.getElementById(fieldToUpdateComboboxId(rowIndex))?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldConfigurations.length]);

  /**
   * Adding a field renders the new configuration form ABOVE the button, so keyboard/SR users had
   * no way to know anything happened. Move focus into the new row's first control ("Field to
   * Update") — configuring it is why the user clicked — and announce the addition.
   */
  function handleAddField() {
    // New rows are appended, so the new row's index is the previous count
    pendingFocusRowIndex.current = fieldConfigurations.length;
    onAddField(sobject);
  }

  /**
   * The delete button unmounts with its row, which would drop focus on <body>. Move focus to the
   * "Field to Update" combobox of the row that slides into the deleted slot (or the last row when
   * the final row was deleted); the AssistiveStatus count announcement conveys what happened.
   */
  function handleRemoveField(index: number) {
    pendingFocusRowIndex.current = index;
    onRemoveField(sobject, index);
  }

  return (
    <div className={className}>
      <AssistiveStatus
        debounceMs={300}
        // Names the object: several objects render side by side, each with its own count
        message={`${fieldConfigurations.length} ${pluralizeFromNumber('field', fieldConfigurations.length)} configured for ${sobject}`}
      />
      {loading && <Spinner />}
      <Grid verticalAlign="end" wrap>
        {children}
        {fieldConfigurations.map(({ selectedField, selectedFieldMetadata, transformationOptions }, index) => (
          <Fragment key={index}>
            {index !== 0 && (
              <GridCol size={12}>
                <hr className="slds-m-vertical_small slds-m-horizontal_x-small" />
              </GridCol>
            )}
            <GridCol size={12}>
              <MassUpdateRecordsObjectRowField
                comboboxId={fieldToUpdateComboboxId(index)}
                fields={fields}
                selectedField={selectedField}
                disabled={disabled}
                allowDelete={fieldConfigurations.length > 1}
                onchange={(selectedField, fieldMetadata) => onFieldChange(index, selectedField, fieldMetadata)}
                onRemoveRow={() => handleRemoveField(index)}
              />
            </GridCol>
            <MassUpdateRecordsObjectRowValue
              org={org}
              sobject={sobject}
              fields={valueFields}
              selectedField={selectedField}
              transformationOptions={transformationOptions}
              disabled={disabled}
              onOptionsChange={(options) => onOptionsChange(index, sobject, options)}
              onLoadChildFields={onLoadChildFields}
            />

            <GridCol size={12}>
              <MassUpdateRecordsObjectRowCriteria
                sobject={sobject}
                transformationOptions={transformationOptions}
                disabled={disabled}
                filterFn={filterCriteriaFn}
                onOptionsChange={(options) => onOptionsChange(index, sobject, options)}
              />
            </GridCol>

            {!!selectedField && (
              <GridCol size={12} className="slds-p-top_x-small">
                <MassUpdateRecordTransformationText
                  className="slds-m-top_x-small slds-m-left_small"
                  selectedField={selectedField}
                  selectedFieldMetadata={selectedFieldMetadata}
                  transformationOptions={transformationOptions}
                  hasExternalWhereClause={hasExternalWhereClause}
                />
              </GridCol>
            )}
          </Fragment>
        ))}
        <GridCol size={12}>
          <div className="slds-m-top_x-small">
            <button className="slds-button slds-button_neutral" disabled={disabled} onClick={handleAddField}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              Add Field
            </button>
          </div>
        </GridCol>
        {recordLimit && (
          <GridCol size={12} className="slds-m-top_small">
            <MassUpdateRecordsObjectRowLimit
              sobject={sobject}
              limit={recordLimit.limit}
              disabled={disabled}
              onChange={recordLimit.onChange}
            />
          </GridCol>
        )}
      </Grid>
      {validationResults && (
        <footer className="slds-card__footer">
          {validationResults && isNumber(validationResults?.impactedRecords) && (
            <ScopedNotification theme="info" className="slds-m-top_x-small w-100">
              {formatNumber(validationResults.impactedRecords)} {pluralizeFromNumber('record', validationResults.impactedRecords)} will be
              updated
              {validationResults.impactedRecords > 0 && (
                <button
                  className="slds-button slds-button_neutral slds-m-left_small slds-is-relative"
                  disabled={downloadRecordsLoading}
                  onClick={handleDownloadValidationRecords}
                >
                  {downloadRecordsLoading ? <Spinner size="x-small" /> : null}
                  Download Records
                </button>
              )}
            </ScopedNotification>
          )}
          {validationResults?.error && (
            <ScopedNotification theme="error" className="slds-m-top_x-small w-100">
              <pre>{validationResults.error}</pre>
            </ScopedNotification>
          )}
        </footer>
      )}
      {downloadModalData.open && (
        <FileDownloadModal
          modalHeader="Download Validation Records"
          org={org}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleDownloadModalClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="mass_update_validation"
          trackEvent={trackEvent}
        />
      )}
    </div>
  );
};

export default MassUpdateRecordsObjectRow;
