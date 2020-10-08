/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent, useEffect, useState } from 'react';
import { Grid, GridCol, DropDown } from '@jetstream/ui';
import { EntityParticleRecordWithRelatedExtIds, FieldMapping } from '../load-records-types';
import { autoMapFields } from '../utils/load-records-utils';
import LoadRecordsFieldMappingRow from './LoadRecordsFieldMappingRow';

const MAPPING_CLEAR = 'CLEAR';
const MAPPING_RESET = 'RESET';

export interface LoadRecordsFieldMappingProps {
  fields: EntityParticleRecordWithRelatedExtIds[];
  inputHeader: string[];
  fieldMapping: FieldMapping;
  fileData: any[]; // first row will be used to obtain header
  onFieldMappingChange: (fieldMapping: FieldMapping) => void;
}

export const LoadRecordsFieldMapping: FunctionComponent<LoadRecordsFieldMappingProps> = ({
  fields,
  inputHeader,
  fieldMapping: fieldMappingInit,
  fileData,
  onFieldMappingChange,
}) => {
  const [firstRow] = useState<string[]>(() => fileData[0]);
  // hack to force child re-render when fields are re-mapped
  const [keyPrefix, setKeyPrefix] = useState<number>(() => new Date().getTime());
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(() => JSON.parse(JSON.stringify(fieldMappingInit)));

  // function handleSave() {
  //   onClose(fieldMapping);
  // }

  useEffect(() => {
    onFieldMappingChange(fieldMapping);
  }, [fieldMapping]);

  /**
   * This is purposefully mutating this state data to avoid re-rendering each child which makes the app seem slow
   * Each child handles its own re-render and stores this state there
   * comboboxes are expensive to re-render if there are many on the page
   *
   * // TODO: figure out how/when to pass to parent to allow reloading without constant re-render
   */
  function handleFieldMappingChange(csvField: string, field: string) {
    // fieldMapping[csvField] = { ...fieldMapping[csvField], targetField: field };
    setFieldMapping((fieldMapping) => ({ ...fieldMapping, [csvField]: { ...fieldMapping[csvField], targetField: field } }));
  }

  function handleAction(id: string) {
    switch (id) {
      case MAPPING_CLEAR:
        setFieldMapping({});
        break;
      case MAPPING_RESET:
        setFieldMapping(autoMapFields(inputHeader, fields));
        break;

      default:
        break;
    }
    setKeyPrefix(new Date().getTime());
  }

  return (
    <Grid vertical>
      <GridCol>Add filters for "all/mapped/unmapped" like DL.io</GridCol>
      <GridCol grow>
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
              <th
                scope="col"
                css={css`
                  width: 75px;
                `}
              >
                <DropDown
                  position="right"
                  actionText="Mapping Options"
                  description="Mapping Options"
                  leadingIcon={{ type: 'utility', icon: 'settings' }}
                  items={[
                    { id: MAPPING_CLEAR, icon: { type: 'utility', icon: 'clear', description: 'Clear mapping' }, value: 'Clear Mapping' },
                    {
                      id: MAPPING_RESET,
                      icon: { type: 'utility', icon: 'undo', description: 'Reset mapping to defaults' },
                      value: 'Reset Mapping',
                    },
                  ]}
                  onSelected={handleAction}
                />
              </th>
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
      </GridCol>
    </Grid>
  );
};

export default LoadRecordsFieldMapping;
