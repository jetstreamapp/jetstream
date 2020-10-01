/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Icon, Modal } from '@jetstream/ui';
import { DescribeGlobalSObjectResult, Field } from 'jsforce';
import { Fragment, FunctionComponent, useState } from 'react';
import { EntityParticleRecordWithRelatedExtIds, FieldMapping, FieldMappingItem } from '../load-records-types';
import { autoMapFields } from '../utils/load-records-utils';
import LoadRecordsFieldMappingRow from './LoadRecordsFieldMappingRow';

export interface LoadRecordsFieldMappingProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  fields: EntityParticleRecordWithRelatedExtIds[];
  inputHeader: string[];
  fieldMapping: FieldMapping;
  fileData: any[]; // first row will be used to obtain header
  onClose: (fieldMapping?: FieldMapping) => void;
}

export const LoadRecordsFieldMapping: FunctionComponent<LoadRecordsFieldMappingProps> = ({
  selectedOrg,
  selectedSObject,
  fields,
  inputHeader,
  fieldMapping: fieldMappingInit,
  fileData,
  onClose,
}) => {
  const [firstRow] = useState<string[]>(() => fileData[0]);
  // hack to force child re-render when fields are re-mapped
  const [keyPrefix, setKeyPrefix] = useState<number>(() => new Date().getTime());
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(() => JSON.parse(JSON.stringify(fieldMappingInit)));

  function handleSave() {
    onClose(fieldMapping);
  }

  /**
   * This is purposefully mutating this state data to avoid re-rendering each child which makes the app seem slow
   * Each child handles its own re-render and stores this state there
   * comboboxes are expensive to re-render if there are many on the page
   *
   */
  function handleFieldMappingChange(csvField: string, field: string) {
    fieldMapping[csvField] = { ...fieldMapping[csvField], targetField: field };
    setFieldMapping(fieldMapping);
  }

  function handleResetMapping() {
    setFieldMapping(autoMapFields(inputHeader, fields));
    setKeyPrefix(new Date().getTime());
  }

  return (
    <Modal
      header="Map fields"
      tagline={selectedSObject.label}
      footer={
        <Grid align="spread">
          <GridCol>
            <button className="slds-button slds-button_neutral" title="Reset Mapping" onClick={handleResetMapping}>
              <Icon type="utility" icon="undo" className="slds-button__icon slds-button__icon_left" omitContainer />
              Reset Mapping
            </button>
          </GridCol>
          <GridCol>
            <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
              Cancel
            </button>
            <button className="slds-button slds-button_brand" onClick={handleSave}>
              Save
            </button>
          </GridCol>
        </Grid>
      }
      size="lg"
      className="slds-scrollable"
      onClose={() => onClose()}
    >
      <div className="slds-grid slds-grid_vertical">
        <div className="slds-grow">
          <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout">
            <thead>
              <tr className="slds-line-height_reset">
                <th
                  scope="col"
                  css={css`
                    width: 200px;
                  `}
                >
                  <div className="slds-truncate" title="Example Data">
                    Example Data
                  </div>
                </th>
                <th scope="col">
                  <div className="slds-truncate" title="Field from File">
                    Field from File
                  </div>
                </th>
                <th
                  scope="col"
                  css={css`
                    width: 35px;
                  `}
                ></th>
                <th scope="col">
                  <div className="slds-truncate" title="Salesforce Field">
                    Salesforce Field
                  </div>
                </th>
                <th scope="col"></th>
                <th
                  scope="col"
                  css={css`
                    width: 75px;
                  `}
                ></th>
              </tr>
            </thead>
            <tbody>
              {inputHeader.map((header, i) => (
                <LoadRecordsFieldMappingRow
                  key={`${keyPrefix}-${i}`}
                  fields={fields}
                  fieldMappingItem={fieldMapping[header]}
                  csvField={header}
                  csvRowData={firstRow[header]}
                  onSelectionChanged={handleFieldMappingChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default LoadRecordsFieldMapping;
