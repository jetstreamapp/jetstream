import { css } from '@emotion/react';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Modal, Tabs } from '@jetstream/ui';
import type { Field } from 'jsforce';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { FieldValues } from '../../shared/create-fields/create-fields-types';
import { getInitialValues, getSecondaryTypeFromType } from '../../shared/create-fields/create-fields-utils';
import useCreateFields from '../../shared/create-fields/useCreateFields';
import { NullNumberBehavior } from '../formula-evaluator.state';
import FormulaEvaluatorFields from './FormulaEvaluatorFields';

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
  const [allValid, setAllValid] = useState(true);
  const [sObjects] = useState([sobject]);
  const [field, setField] = useState<FieldValues>(() => {
    const value = getInitialValues(0);
    value.label.value = selectedField?.label || '';
    value.fullName.value = (selectedField?.name || '').replace('__c', '');
    value.type.value = 'Formula';
    value.inlineHelpText.value = selectedField?.inlineHelpText || '';
    value.description.value = (selectedField as any)?.description || '';
    value.formula.value = formula;
    value.formulaTreatBlanksAs.value = numberNullBehaviorState === 'BLANK' ? 'Blanks' : 'BlankAsZero';
    value.secondaryType.value = selectedField?.type ? getSecondaryTypeFromType(selectedField.type) : 'Text';
    value.precision.value = selectedField?.precision || '18';
    value.scale.value = selectedField?.scale || '0';
    return value;
  });

  const { deployFields, prepareFields, deployed, fatalError, fatalErrorMessage, layoutErrorMessage, loading, results } = useCreateFields({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
    permissionSets: [],
    profiles: [],
    sObjects,
  });

  function onFieldChange(field: FieldValues, isValid: boolean) {
    setField(field);
    setAllValid(isValid);
  }

  async function deploy() {
    // TODO: try catch, show user progress, etc..
    // TODO: payload for blankAsFoo is not a valid value
    const prepareResults = await prepareFields([field]);
    if (!prepareResults) {
      // TODO:
      return;
    }
    deployFields(prepareResults, []);
  }

  return (
    <Modal
      header="Save Field"
      tagline="Field will be upserted based on the Field Name."
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" disabled={!allValid || loading} onClick={() => deploy()}>
            Validate
          </button>
        </>
      }
      onClose={onClose}
    >
      <div
        css={css`
          min-height: 550px;
        `}
      >
        {/* TODO: (below) - maybe use tabs or "wizard" to step through? */}
        {/* Permissions -> Profile/Perm Set (if new) */}
        {/* Page Layout */}

        {/* TODO: handle deployment and results */}

        <Tabs
          initialActiveId="field"
          contentClassname="slds-p-bottom_none"
          tabs={[
            {
              id: 'field',
              titleClassName: 'slds-size_1-of-3',
              title: 'Field', // TODO: show an icon if configured
              content: <FormulaEvaluatorFields formula={formula} field={field} loading={loading} onFieldChange={onFieldChange} />,
            },
            {
              id: 'permissions',
              titleClassName: 'slds-size_1-of-3',
              title: 'Field Permissions', // TODO: show an icon if configured
              content: 'TODO',
            },
            {
              id: 'layouts',
              titleClassName: 'slds-size_1-of-3',
              title: 'Page Layouts', // TODO: show an icon if configured
              content: 'TODO',
            },
          ]}
        />
      </div>
    </Modal>
  );
};

export default FormulaEvaluatorDeployModal;
