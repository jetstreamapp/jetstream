import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { parseFile } from '@jetstream/shared/ui-utils';
import { ensureBoolean } from '@jetstream/shared/utils';
import { InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, DropDown, FileDownloadModal, FileSelector, Icon, Popover, PopoverRef } from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import * as fromJetstreamEvents from '../core/jetstream-events';
import { CREATE_FIELDS_EXAMPLE_TEMPLATE } from './create-fields-import-example';
import { FieldValues, SalesforceFieldType } from './create-fields-types';
import { allFields, baseFields, fieldDefinitions, fieldTypeDependencies, fieldTypeDependenciesExport } from './create-fields-utils';

export interface CreateFieldsImportExportProps {
  selectedOrg: SalesforceOrgUi;
  rows: FieldValues[];
  onImportRows: (rows: FieldValues[]) => void;
}

export const CreateFieldsImportExport: FunctionComponent<CreateFieldsImportExportProps> = ({ selectedOrg, rows, onImportRows }) => {
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const popoverRef = useRef<PopoverRef>();
  const [exportData, setExportData] = useState<any[]>(rows);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  function handleCloseModal() {
    setExportModalOpen(false);
  }

  function handleExport() {
    const BASE_FIELDS = new Set(baseFields);
    setExportData(
      rows.map((row) =>
        allFields.reduce((output, field) => {
          if (BASE_FIELDS.has(field) || fieldTypeDependenciesExport[row.type.value as SalesforceFieldType].includes(field)) {
            if (field === 'globalValueSet' && row._picklistGlobalValueSet) {
              output[field] = row[field].value;
            } else if (field === 'valueSet' && !row._picklistGlobalValueSet) {
              output[field] = row[field].value;
            } else if (field !== 'globalValueSet' && field !== 'valueSet') {
              output[field] = row[field].value;
            }
          }
          return output;
        }, {})
      )
    );
    setExportModalOpen(true);
  }

  async function handleImport({ content }: InputReadFileContent) {
    // TODO: error messaging
    const { data, errors } = await parseFile(content);
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
    // TODO:
    if (id === 'export-example') {
      setExportData(CREATE_FIELDS_EXAMPLE_TEMPLATE);
      setExportModalOpen(true);
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
            <FileSelector
              id="import-create-fields"
              label="Import Fields File"
              accept={[INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]}
              onReadFile={handleImport}
            ></FileSelector>
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
