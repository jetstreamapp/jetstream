import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { FieldMapping } from '@jetstream/types';
import { Grid, Icon, Input, Popover, PopoverRef, ScopedNotification, Tooltip } from '@jetstream/ui';
import { fromLoadRecordsState } from '@jetstream/ui-core';
import { formatISO } from 'date-fns/formatISO';
import omit from 'lodash/omit';
import { FunctionComponent, useMemo, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

const getDefaultItem = (sobject: string): fromLoadRecordsState.LoadSavedMappingItem => ({
  key: '',
  name: '',
  sobject,
  csvFields: [],
  sobjectFields: [],
  mapping: {},
  createdDate: new Date(),
});

export interface SaveMappingPopoverProps {
  sobject: string;
  fieldMapping: FieldMapping;
}

export const SaveMappingPopover: FunctionComponent<SaveMappingPopoverProps> = ({ sobject, fieldMapping }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const [mappingName, saveSetMappingName] = useState('');
  const [currentSavedMapping, setCurrentSavedMapping] = useState<fromLoadRecordsState.LoadSavedMappingItem>(() => getDefaultItem(sobject));
  const setFieldMappingState = useSetRecoilState(fromLoadRecordsState.savedFieldMappingState);

  const hasErrors = useMemo(
    () =>
      Object.values(fieldMapping).some(
        (fieldMappingItem) =>
          fieldMappingItem.isDuplicateMappedField || (fieldMappingItem.mappedToLookup && !fieldMappingItem.relatedFieldMetadata)
      ),
    [fieldMapping]
  );

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      saveSetMappingName('');
      setCurrentSavedMapping(
        Object.keys(fieldMapping).reduce((acc: fromLoadRecordsState.LoadSavedMappingItem, key) => {
          const field = fieldMapping[key];
          if (field.targetField) {
            acc.csvFields.push(key);
            acc.sobjectFields.push(field.targetField);
            acc.mapping[key] = omit({ ...field }, 'fieldMetadata');
          }
          return acc;
        }, getDefaultItem(sobject))
      );
    }
  }

  function handleSave() {
    const newMapping: fromLoadRecordsState.LoadSavedMappingItem = { ...currentSavedMapping, name: mappingName };
    newMapping.createdDate = new Date();
    newMapping.key = `${sobject}:${newMapping.csvFields.length}:${formatISO(newMapping.createdDate)}`;
    setFieldMappingState((prevItems) => ({
      ...prevItems,
      [sobject]: {
        ...(prevItems[sobject] || {}),
        [newMapping.key]: newMapping,
      },
    }));
    saveSetMappingName('');
    setCurrentSavedMapping(getDefaultItem(sobject));
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      onChange={handleOpen}
      placement="bottom-end"
      footer={
        <footer className="slds-popover__footer">
          <p>Saved field mappings will be available for use with {sobject} as long as your input file contains every mapped field.</p>
        </footer>
      }
      content={
        <form
          css={css`
            max-height: 80vh;
          `}
          onSubmit={(ev) => {
            ev.preventDefault();
            handleSave();
          }}
        >
          <h3 className="slds-text-heading_small slds-m-bottom_small">Save Field Mapping</h3>
          {hasErrors && <ScopedNotification theme="error">You have mapping errors that need to be fixed.</ScopedNotification>}
          <Grid className="slds-m-bottom_x-small">
            <span>{sobject}</span>
            <span className="slds-m-horizontal_xx-small">•</span>
            <span>
              {formatNumber(currentSavedMapping.csvFields.length)} Mapped {pluralizeIfMultiple('Field', currentSavedMapping.csvFields)}
            </span>
          </Grid>
          <Input label="Mapping Name" className="slds-grow">
            <input
              className="slds-input"
              value={mappingName}
              maxLength={80}
              autoComplete="off"
              autoFocus
              onChange={(event) => saveSetMappingName(event.target.value)}
            />
          </Input>
          <button
            type="submit"
            className="slds-button slds-button_brand slds-m-top_x-small"
            disabled={!mappingName || !currentSavedMapping.csvFields.length || hasErrors}
          >
            Save
          </button>
        </form>
      }
      buttonProps={{
        className: '',
        as: 'div',
      }}
    >
      <Tooltip content={'Save field mapping'}>
        <button className="slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_neutral slds-button_first">
          <Icon type="utility" icon="save" className="slds-button__icon slds-button__icon_left" omitContainer />
          Save
        </button>
      </Tooltip>
    </Popover>
  );
};

export default SaveMappingPopover;
