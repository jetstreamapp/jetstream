import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { REGEX, getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { GlobalValueSetRequest, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, GridCol, Input, Modal, ScopedNotification, Spinner, Textarea } from '@jetstream/ui';
import { applicationCookieState, createGlobalPicklist, generateApiNameFromLabel, useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

interface PicklistData {
  label: string;
  name: string;
  description: string;
  values: string;
  sorted: boolean;
  useFirstAsDefault: boolean;
}

const defaultValues: PicklistData = {
  label: '',
  name: '',
  description: '',
  values: '',
  sorted: false,
  useFirstAsDefault: false,
};

function getPayload(data: PicklistData): GlobalValueSetRequest {
  return {
    FullName: `${data.name}__gvs`,
    Metadata: {
      customValue: data.values
        .trim()
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value, i) => ({
          default: data.useFirstAsDefault && i === 0,
          isActive: true,
          valueName: value,
        })),
      description: data.description,
      masterLabel: data.label,
      sorted: data.sorted,
    },
  };
}

export interface CreateNewGlobalPicklistModalProps {
  selectedOrg: SalesforceOrgUi;
  onCreated: (name: string) => void;
}

export const CreateNewGlobalPicklistModal: FunctionComponent<CreateNewGlobalPicklistModalProps> = ({ selectedOrg, onCreated }) => {
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [picklistData, setPicklistData] = useState<PicklistData>({ ...defaultValues });
  const [isValid, setIsValid] = useState(false);
  const [loading, setIsLoading] = useState(false);

  useEffect(() => {
    // FIXME: add in length validations - also we should have error messages per field
    setIsValid(
      picklistData.label && picklistData.name && !REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE.test(picklistData.name) && picklistData.values
        ? true
        : false
    );
  }, [picklistData]);

  async function handleSave() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      await createGlobalPicklist(selectedOrg, getPayload(picklistData), defaultApiVersion);
      onCreated(picklistData.name);

      trackEvent(ANALYTICS_KEYS.sobj_create_field_global_picklist);
      handleCloseModal();
    } catch (ex) {
      setErrorMessage(`There was a problem creating the picklist. ${getErrorMessage(ex)}`);
      rollbar.error('Create Fields: Global Picklist creation failed', {
        ...getErrorMessageAndStackObj(ex),
        picklistData,
        payload: getPayload(picklistData),
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleCloseModal() {
    setPicklistData({ ...defaultValues });
    setIsOpen(false);
  }

  function handleChange(field: keyof PicklistData, value: string | boolean) {
    const newValue = {
      ...picklistData,
      [field]: value,
    };
    if (field === 'label') {
      newValue.name = generateApiNameFromLabel((value as string) || '');
    }
    setPicklistData(newValue);
  }

  const { label, name, description, values, sorted, useFirstAsDefault } = picklistData;

  return (
    <div>
      {isOpen && (
        <Modal
          closeOnEsc={false}
          closeOnBackdropClick={false}
          header="Create Global Value Set"
          footer={
            <div>
              <button className="slds-button slds-button_neutral" onClick={handleCloseModal} disabled={loading}>
                Cancel
              </button>
              <button
                className="slds-button slds-button_brand"
                form="global-picklist-form"
                type="submit"
                onClick={handleSave}
                disabled={!isValid || loading}
              >
                Save
              </button>
            </div>
          }
          size="md"
          onClose={handleCloseModal}
        >
          <div
            className="slds-is-relative"
            css={css`
              min-height: 300px;
            `}
          >
            {errorMessage && (
              <div className="slds-m-around-medium">
                <ScopedNotification theme="error" className="slds-m-top_medium">
                  <p>{errorMessage}</p>
                </ScopedNotification>
              </div>
            )}
            <form id="global-picklist-form" onSubmit={handleSave}>
              <Grid vertical>
                {loading && <Spinner size="small" />}
                <Grid gutters wrap>
                  <GridCol size={12} sizeMedium={6}>
                    <Input id="global-label" label="Label" isRequired>
                      <input
                        id="global-label"
                        className="slds-input"
                        maxLength={40}
                        value={label}
                        disabled={loading}
                        onChange={(event) => handleChange('label', event.target.value)}
                      />
                    </Input>
                  </GridCol>
                  <GridCol size={12} sizeMedium={6}>
                    <Input
                      id="global-name"
                      className="slds-grow"
                      label="API Name"
                      isRequired
                      helpText="Cannot have spaces or double underscore"
                    >
                      <input
                        id="global-name"
                        className="slds-input"
                        maxLength={40}
                        pattern="^[a-zA-Z0-9_]*$"
                        value={name}
                        disabled={loading}
                        onChange={(event) => handleChange('name', event.target.value)}
                      />
                    </Input>
                  </GridCol>
                </Grid>
                <Input id="global-description" label="Description">
                  <input
                    id="global-description"
                    className="slds-input"
                    maxLength={255}
                    value={description}
                    disabled={loading}
                    onChange={(event) => handleChange('description', event.target.value)}
                  />
                </Input>
                <Textarea id="global-values" label="Values" isRequired>
                  <textarea
                    id="global-values"
                    className="slds-textarea"
                    value={values}
                    disabled={loading}
                    onChange={(event) => handleChange('values', event.target.value)}
                  />
                </Textarea>
                <Checkbox
                  id="global-sorted"
                  label="Display values alphabetically, not in the order entered"
                  checked={sorted}
                  disabled={loading}
                  onChange={(newValue) => handleChange('sorted', newValue)}
                />
                <Checkbox
                  id="global-first-as-default"
                  label="Use first as default value"
                  checked={useFirstAsDefault}
                  disabled={loading}
                  onChange={(newValue) => handleChange('useFirstAsDefault', newValue)}
                />
              </Grid>
            </form>
          </div>
        </Modal>
      )}
      <div>
        <button className="slds-button" onClick={() => setIsOpen(true)}>
          + Create New Global Picklist
        </button>
      </div>
    </div>
  );
};

export default CreateNewGlobalPicklistModal;
