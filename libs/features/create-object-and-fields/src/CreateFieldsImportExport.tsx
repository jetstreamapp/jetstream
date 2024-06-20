import { ANALYTICS_KEYS, INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { parseFile } from '@jetstream/shared/ui-utils';
import { REGEX, ensureBoolean } from '@jetstream/shared/utils';
import { InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import {
  ButtonGroupContainer,
  DropDown,
  FileDownloadModal,
  FileSelector,
  Icon,
  Popover,
  PopoverRef,
  fireToast,
  onParsedMultipleWorkbooks,
} from '@jetstream/ui';
import {
  FieldValues,
  allFields,
  applicationCookieState,
  ensureValidSecondaryType,
  ensureValidType,
  fieldDefinitions,
  fromJetstreamEvents,
  getRowsForExport,
  useAmplitude,
} from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CREATE_FIELDS_EXAMPLE_TEMPLATE } from './create-fields-import-example';

export interface CreateFieldsImportExportProps {
  selectedOrg: SalesforceOrgUi;
  rows: FieldValues[];
  onImportRows: (rows: FieldValues[]) => void;
}

export const CreateFieldsImportExport: FunctionComponent<CreateFieldsImportExportProps> = ({ selectedOrg, rows, onImportRows }) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const popoverRef = useRef<PopoverRef>(null);
  const [exportData, setExportData] = useState<any[]>(rows);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  function handleCloseModal() {
    setExportModalOpen(false);
  }

  function handleExport() {
    setExportData(getRowsForExport(rows));
    setExportModalOpen(true);
    trackEvent(ANALYTICS_KEYS.sobj_create_field_export_fields, { numFields: rows.length });
  }

  async function handleImport({ content }: InputReadFileContent) {
    // eslint-disable-next-line prefer-const
    let { data, errors } = await parseFile(content, { onParsedMultipleWorkbooks });
    trackEvent(ANALYTICS_KEYS.sobj_create_field_import_fields, {
      numFields: data.length,
      hasErrors: errors.length,
      errors,
    });
    if (errors.length) {
      fireToast({
        message: 'There were errors reading your import file.',
        type: 'error',
      });
    }
    // ensure all keys are lowercase to match up with expected field names
    data = data.map((row) => {
      return Object.keys(row).reduce((normalizedRow: Record<string, unknown>, key) => {
        normalizedRow[key.toLowerCase().replace(REGEX.NOT_ALPHA, '')] = row[key];
        return normalizedRow;
      }, {});
    });
    // transform data into correct format
    onImportRows(
      data.map(
        (row): FieldValues =>
          allFields.reduce((output, field) => {
            let value = row[field.toLowerCase()];
            if (fieldDefinitions[field].type === 'checkbox') {
              value = ensureBoolean(value);
            }
            if (field === 'type') {
              value = ensureValidType(value);
            }
            if (field === 'deleteConstraint' && value) {
              value = ['SetNull', 'Cascade', 'Restrict'].includes(value) ? value : 'SetNull';
            }
            if (field === 'secondaryType' && value) {
              value = ensureValidSecondaryType(value);
            }
            if (field === 'writeRequiresMasterRead' && value) {
              value = value === 'true' ? 'true' : 'false';
            }
            output[field] = {
              value,
              touched: true,
              isValid: true,
              errorMessage: null,
            };
            return output;
          }, {} as FieldValues)
      )
    );
    popoverRef.current?.close();
  }

  function handleMenuSelection(id: string) {
    if (id === 'export-example') {
      setExportData(CREATE_FIELDS_EXAMPLE_TEMPLATE);
      setExportModalOpen(true);
      trackEvent(ANALYTICS_KEYS.sobj_create_field_export_example);
    }
  }

  return (
    <Fragment>
      {exportModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Fields"
          data={exportData}
          header={allFields}
          fileNameParts={['fields']}
          allowedTypes={['xlsx', 'csv']}
          onModalClose={() => handleCloseModal()}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      <ButtonGroupContainer>
        <button
          className="slds-button slds-button_neutral slds-button_first collapsible-button collapsible-button-lg"
          onClick={() => handleExport()}
        >
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>Export Fields</span>
        </button>
        <Popover
          ref={popoverRef}
          placement="bottom-end"
          content={
            <div>
              <FileSelector
                id="import-create-fields"
                label="Import Fields File"
                accept={[INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]}
                userHelpText={<span>The headers are case-sensitive.</span>}
                onReadFile={handleImport}
              ></FileSelector>
              <div>
                Download the{' '}
                <button className="slds-button" onClick={() => handleMenuSelection('export-example')}>
                  example template
                </button>{' '}
                for an example.
              </div>
            </div>
          }
          buttonProps={{
            className: 'slds-button slds-button_neutral slds-button_middle collapsible-button collapsible-button-lg',
          }}
        >
          <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>Import Fields</span>
        </Popover>
        <DropDown
          className="slds-button_last"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          items={[{ id: 'export-example', value: 'Export Example Template' }]}
          onSelected={handleMenuSelection}
        />
      </ButtonGroupContainer>
    </Fragment>
  );
};

export default CreateFieldsImportExport;
