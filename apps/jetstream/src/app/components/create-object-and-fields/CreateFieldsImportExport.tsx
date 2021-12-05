import { ANALYTICS_KEYS, INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { parseFile } from '@jetstream/shared/ui-utils';
import { ensureBoolean } from '@jetstream/shared/utils';
import { InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import {
  ButtonGroupContainer,
  DropDown,
  FileDownloadModal,
  FileSelector,
  Icon,
  onParsedMultipleWorkbooks,
  Popover,
  PopoverRef,
} from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import * as fromJetstreamEvents from '../core/jetstream-events';
import { CREATE_FIELDS_EXAMPLE_TEMPLATE } from './create-fields-import-example';
import { FieldValues } from './create-fields-types';
import { allFields, fieldDefinitions, getRowsForExport } from './create-fields-utils';
import { fireToast } from '../core/AppToast';

export interface CreateFieldsImportExportProps {
  selectedOrg: SalesforceOrgUi;
  rows: FieldValues[];
  onImportRows: (rows: FieldValues[]) => void;
}

export const CreateFieldsImportExport: FunctionComponent<CreateFieldsImportExportProps> = ({ selectedOrg, rows, onImportRows }) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const popoverRef = useRef<PopoverRef>();
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
    // TODO: error messaging
    const { data, errors } = await parseFile(content, { onParsedMultipleWorkbooks });
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
    onImportRows(
      data.map(
        (row): FieldValues =>
          allFields.reduce((output, field) => {
            let value = row[field];
            if (fieldDefinitions[field].type === 'checkbox') {
              value = ensureBoolean(row[field]);
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
    popoverRef.current.close();
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
        <button className="slds-button slds-button_neutral" onClick={() => handleExport()}>
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          Export Fields
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
                for example usage.
              </div>
            </div>
          }
          buttonProps={{
            className: 'slds-button slds-button_neutral',
          }}
        >
          <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
          Import Fields
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
