/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent, useEffect, useState } from 'react';
import { Grid, GridCol, DropDown } from '@jetstream/ui';
import { EntityParticleRecordWithRelatedExtIds, FieldMapping } from '../load-records-types';
import { autoMapFields } from '../utils/load-records-utils';
import LoadRecordsFieldMappingRow from '../components/LoadRecordsFieldMappingRow';
import { EntityParticleRecord } from '@jetstream/types';

type DropDownAction = 'CLEAR' | 'RESET' | 'ALL' | 'MAPPED' | 'UNMAPPED';

const MAPPING_CLEAR: DropDownAction = 'CLEAR';
const MAPPING_RESET: DropDownAction = 'RESET';

const FILTER_ALL: DropDownAction = 'ALL';
const FILTER_MAPPED: DropDownAction = 'MAPPED';
const FILTER_UNMAPPED: DropDownAction = 'UNMAPPED';

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
  const [visibleFields, setVisibleFields] = useState<EntityParticleRecordWithRelatedExtIds[]>(() => fields);

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
   */
  function handleFieldMappingChange(csvField: string, field: string, relatedField?: string) {
    let fieldMetadata = fields.find((currField) => currField.Name === field);
    if (relatedField) {
      fieldMetadata = fieldMetadata.attributes.relatedRecords.find(
        (currField) => currField.Name === relatedField
      ) as EntityParticleRecordWithRelatedExtIds;
    }
    setFieldMapping((fieldMapping) => ({ ...fieldMapping, [csvField]: { ...fieldMapping[csvField], targetField: field, fieldMetadata } }));
  }

  function handleAction(id: DropDownAction) {
    switch (id) {
      case MAPPING_CLEAR:
        setFieldMapping({});
        break;
      case MAPPING_RESET:
        setFieldMapping(autoMapFields(inputHeader, fields));
        break;
      case FILTER_ALL:
        setFieldMapping(autoMapFields(inputHeader, fields));
        break;
      case FILTER_MAPPED:
        setFieldMapping(autoMapFields(inputHeader, fields));
        break;
      case FILTER_UNMAPPED:
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
      <GridCol>Allow mapping to related field</GridCol>
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
                {/* TODO: this requires selectable dropdown, which requires refactors */}
                {/* <DropDown
                  position="right"
                  actionText="Mapping Filter"
                  description="Mapping Filter"
                  leadingIcon={{ type: 'utility', icon: 'filterList' }}
                  items={[
                    { id: FILTER_ALL, value: 'Show All' },
                    { id: FILTER_MAPPED, value: 'Show Mapped' },
                    { id: FILTER_UNMAPPED, value: 'Show Unmapped' },
                  ]}
                  onSelected={handleAction}
                /> */}
              </th>
            </tr>
          </thead>
          <tbody>
            {inputHeader.map((header, i) => (
              <LoadRecordsFieldMappingRow
                key={`${keyPrefix}-${i}`}
                fields={visibleFields}
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
