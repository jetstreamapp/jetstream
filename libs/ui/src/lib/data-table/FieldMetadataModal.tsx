import { css } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile } from '@jetstream/shared/ui-utils';
import { Field } from '@jetstream/types';
import { FunctionComponent } from 'react';
import Badge from '../badge/Badge';
import { ReadOnlyFormElement } from '../form/readonly-form-element/ReadOnlyFormElement';
import Grid from '../grid/Grid';
import GridCol from '../grid/GridCol';
import Modal from '../modal/Modal';
import Icon from '../widgets/Icon';

/** Field types where the `length` property is meaningful (string-like). */
const STRING_LIKE_TYPES = new Set<Field['type']>(['string', 'textarea', 'email', 'phone', 'url', 'encryptedstring']);
/** Field types where `precision`/`scale` are meaningful (numeric). */
const NUMERIC_TYPES = new Set<Field['type']>(['int', 'double', 'currency', 'percent']);

export interface FieldMetadataRow {
  id: string;
  label: string;
  value: string | number | boolean | null;
  labelHelp?: string;
}

/**
 * Build the flat label/value rows shown in the modal grid. Type/label/help/references/picklist are
 * rendered as dedicated sections elsewhere; this returns the API name, type-relevant sizing
 * (length for string-like, precision/scale for numeric), and the key boolean flags.
 */
export function buildFieldMetadataRows(field: Field): FieldMetadataRow[] {
  const rows: FieldMetadataRow[] = [{ id: 'fm-name', label: 'API Name', value: field.name }];

  if (STRING_LIKE_TYPES.has(field.type)) {
    rows.push({ id: 'fm-length', label: 'Length', value: field.length });
  }
  if (NUMERIC_TYPES.has(field.type)) {
    rows.push({ id: 'fm-precision', label: 'Precision', value: field.precision ?? null });
    rows.push({ id: 'fm-scale', label: 'Scale', value: field.scale });
  }

  rows.push(
    { id: 'fm-custom', label: 'Custom', value: field.custom },
    { id: 'fm-calculated', label: 'Calculated', value: field.calculated },
    { id: 'fm-nillable', label: 'Nillable', value: field.nillable },
    { id: 'fm-createable', label: 'Createable', value: field.createable },
    { id: 'fm-updateable', label: 'Updateable', value: field.updateable },
  );

  return rows;
}

const scrollContainerStyles = css`
  max-height: 12rem;
  overflow: auto;
`;

export interface FieldMetadataModalProps {
  field: Field;
  columnName?: string;
  onClose: () => void;
  /** Fired after the raw field JSON is downloaded (e.g. for analytics). */
  onDownload?: () => void;
}

export const FieldMetadataModal: FunctionComponent<FieldMetadataModalProps> = ({ field, columnName, onClose, onDownload }) => {
  const handleDownloadJson = () => {
    saveFile(JSON.stringify(field, null, 2), `field-metadata-${field.name}.json`, MIME_TYPES.JSON);
    onDownload?.();
  };

  return (
    <Modal
      header={`Field Metadata${columnName ? `: ${columnName}` : ''}`}
      size="md"
      onClose={onClose}
      footer={
        <Grid align="spread">
          <button className="slds-button slds-button_neutral" onClick={handleDownloadJson}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download JSON
          </button>
          <button className="slds-button slds-button_neutral" onClick={onClose}>
            Close
          </button>
        </Grid>
      }
    >
      <Grid wrap>
        <GridCol size={6}>
          <ReadOnlyFormElement id="fm-label" label="Label" value={field.label} labelHelp={field.inlineHelpText ?? undefined} bottomBorder />
        </GridCol>
        <GridCol size={6}>
          <div className="slds-form-element">
            <span className="slds-form-element__label">Type</span>
            <div className="slds-form-element__control slds-border_bottom">
              <div className="slds-form-element__static">
                {field.type}
                {field.calculated && (
                  <Badge className="slds-m-left_xx-small" type="light">
                    Calculated
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </GridCol>
        {buildFieldMetadataRows(field).map((row) => (
          <GridCol key={row.id} size={6}>
            <ReadOnlyFormElement id={row.id} label={row.label} value={row.value} labelHelp={row.labelHelp} bottomBorder />
          </GridCol>
        ))}
      </Grid>

      {field.inlineHelpText && (
        <div className="slds-m-top_small">
          <ReadOnlyFormElement id="fm-help" label="Help Text" value={field.inlineHelpText} bottomBorder />
        </div>
      )}

      {!!field.referenceTo?.length && (
        <div className="slds-m-top_small">
          <span className="slds-form-element__label">References</span>
          <div>
            {field.referenceTo.map((sobject) => (
              <Badge key={sobject} className="slds-m-right_xx-small slds-m-bottom_xx-small">
                {sobject}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {!!field.picklistValues?.length && (
        <div className="slds-m-top_small">
          <span className="slds-form-element__label">Picklist Values ({field.picklistValues.length})</span>
          <ul css={scrollContainerStyles} className="slds-has-dividers_bottom-space slds-dropdown_length-with-icon-10">
            {field.picklistValues.map((picklist, index) => (
              <li key={`${picklist.value}-${index}`} className="slds-item read-only">
                <Grid align="spread" verticalAlign="center">
                  <span className="slds-truncate" title={picklist.label ?? picklist.value}>
                    {picklist.label && picklist.label !== picklist.value ? `${picklist.label} (${picklist.value})` : picklist.value}
                  </span>
                  {!picklist.active && (
                    <Badge className="slds-m-left_x-small" type="warning">
                      Inactive
                    </Badge>
                  )}
                </Grid>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
};

export default FieldMetadataModal;
