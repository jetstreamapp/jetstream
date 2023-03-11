import { ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Input, Modal, Picklist } from '@jetstream/ui';
import type { Field } from 'jsforce';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import { FieldDefinitionMetadata, SalesforceFieldType } from '../shared/create-fields/create-fields-types';
import useCreateFields from '../shared/create-fields/useCreateFields';
import { NullNumberBehavior } from './formula-evaluator.state';

const NUMBER_TYPES = new Set<SalesforceFieldType>(['Number', 'Currency', 'Percent']);

const fieldType: ListItem[] = [
  { id: 'checkbox', label: 'Checkbox', value: 'Checkbox' },
  { id: 'currency', label: 'Currency', value: 'Currency' },
  { id: 'date', label: 'Date', value: 'Date' },
  { id: 'datetime', label: 'Datetime', value: 'Datetime' },
  { id: 'number', label: 'Number', value: 'Number' },
  { id: 'percent', label: 'Percent', value: 'Percent' },
  { id: 'text', label: 'Text', value: 'Text' },
  { id: 'time', label: 'Time', value: 'Time' },
];

export interface FormulaEvaluatorDeployModalProps {
  selectedOrg: SalesforceOrgUi;
  sobject: string;
  selectedField?: Maybe<Field>;
  formula: string;
  numberNullBehaviorState: NullNumberBehavior;
  onClose: () => void;
}

export const FormulaEvaluatorDeployModal = ({
  selectedOrg,
  sobject,
  selectedField,
  formula,
  numberNullBehaviorState,
  onClose,
}: FormulaEvaluatorDeployModalProps) => {
  const [{ defaultApiVersion, serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  // const [label, setLabel] = useState<Maybe<string>>(() => selectedField?.label);
  const [name, setName] = useState(() => selectedField?.name || '');
  // const [type, SetType] = useState<Maybe<FieldType>>(() => selectedField?.type);
  // const [description, setDescription] = useState(() => selectedField?.);
  // const [helpText, setHelpText] = useState<string>(() => selectedField?.inlineHelpText || '');

  const [field, setField] = useState<FieldDefinitionMetadata>(() => ({
    type: 'formula',
    label: selectedField?.label || '',
    fullName: `${sobject}.${name}`,
    inlineHelpText: selectedField?.inlineHelpText || '',
    description: (selectedField as any)?.description || '',
    formula: formula,
    formulaTreatBlanksAs: numberNullBehaviorState === 'BLANK' ? undefined : 'BlankAsZero',
    secondaryType: (selectedField as any)?.secondaryType || 'Text',
    precision: '18', // length, required if NUMBER_TYPES.has(secondaryType)
    scale: '0', // decimal places, required if NUMBER_TYPES.has(secondaryType)
  }));

  const { deployFields, deployed, fatalError, fatalErrorMessage, layoutErrorMessage, loading, results } = useCreateFields({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
    permissionSets: [],
    profiles: [],
    rows: [field],
    sObjects: [sobject],
  });

  useEffect(() => {
    setField((priorValue) => ({
      ...priorValue,
      fullName: `${sobject}.${name}`,
    }));
  }, [name, sobject]);

  function setValue(key: keyof FieldDefinitionMetadata, value: any) {
    let extraValues: FieldDefinitionMetadata = {};
    if (key === 'secondaryType') {
      const isNumber = NUMBER_TYPES.has(field.secondaryType);
      extraValues = {
        precision: isNumber ? field.precision ?? '18' : undefined,
        scale: isNumber ? field.scale ?? '0' : undefined,
      };
    } else if (key === 'formulaTreatBlanksAs') {
      value = value === 'BLANK' ? undefined : 'BlankAsZero';
    }
    setField((priorValue) => ({
      ...priorValue,
      [key]: value,
      ...extraValues,
    }));
  }

  return (
    <Modal
      header="Save Field"
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand">Save</button>
        </>
      }
      onClose={onClose}
    >
      <Input label="Field Label">
        <input
          className="slds-input"
          max={18}
          min={15}
          value={field.label || ''}
          autoComplete="off"
          autoFocus
          onChange={(event) => setValue('label', event.target.value)}
        />
      </Input>
      <Input label="Field Name">
        <input
          className="slds-input"
          max={18}
          min={15}
          value={name}
          autoComplete="off"
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </Input>

      {/* TODO: picklist */}
      <Picklist
        className="slds-m-top_x-small"
        label="Field Type"
        items={fieldType}
        selectedItemIds={field.secondaryType ? [field.secondaryType] : []}
        disabled={false}
        onChange={(values) => (values.length > 0 ? setValue('secondaryType', values[0].value) : setValue('secondaryType', 'text'))}
      ></Picklist>

      <Input label="Field Description">
        <input
          className="slds-input"
          max={18}
          min={15}
          value={field.description || ''}
          autoComplete="off"
          autoFocus
          onChange={(event) => setValue('description', event.target.value)}
        />
      </Input>
      <Input label="Field Help Text">
        <input
          className="slds-input"
          max={18}
          min={15}
          value={field.inlineHelpText || ''}
          autoComplete="off"
          autoFocus
          onChange={(event) => setValue('inlineHelpText', event.target.value)}
        />
      </Input>

      {/* Field Label */}
      {/* Field Name */}
      {/* Field Type (secondary type) */}
      {/* Description */}
      {/* Help Text */}
      {/* BlankFieldHandling */}
      {/* Permissions -> Profile/Perm Set (if new) */}
      {/* Page Layout */}
    </Modal>
  );
};

export default FormulaEvaluatorDeployModal;
