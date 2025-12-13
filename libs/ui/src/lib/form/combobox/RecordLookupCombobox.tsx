/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { describeGlobal, describeSObject, query } from '@jetstream/shared/data';
import { DescribeGlobalSObjectResult, FormGroupDropdownItem, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FormGroupDropdown } from '../formGroupDropDown/FormGroupDropdown';
import Input from '../input/Input';
import { ComboboxSharedProps } from './Combobox';
import ComboboxWithItemsTypeAhead, { ComboboxWithItemsTypeAheadProps } from './ComboboxWithItemsTypeAhead';

const INPUT_MODE_LABEL = 'Input Mode';
export const INPUT_MODE_LOOKUP = 'LOOKUP';
export const INPUT_MODE_MANUAL = 'MANUAL';

const INPUT_MODE_OPTIONS: FormGroupDropdownItem[] = [
  { id: INPUT_MODE_LOOKUP, label: 'Lookup', icon: 'record_lookup' },
  { id: INPUT_MODE_MANUAL, label: 'Manual Entry', icon: 'text' },
];
type InputMode = typeof INPUT_MODE_LOOKUP | typeof INPUT_MODE_MANUAL;

interface RecordLookupComboboxProps {
  org: SalesforceOrgUi;
  sobjects: string[];
  value: Maybe<string>;
  comboboxProps: ComboboxSharedProps;
  typeaheadProps?: Partial<Omit<ComboboxWithItemsTypeAheadProps, 'comboboxProps' | 'items' | 'onSearch' | 'selectedItemId' | 'onSelected'>>;
  /**
   * If true, a trailing combobox will be shown to allow switching to manual input mode
   * to allow entering record IDs directly.
   */
  allowManualMode?: boolean;
  /**
   * Input props to pass to <input> when in manual mode
   */
  manualModeInputProps?: Partial<React.InputHTMLAttributes<HTMLInputElement>>;
  onChange: (item: Maybe<string>) => void;
  /**
   * When in lookup mode for polymorphic lookups, called when the object changes
   */
  onObjectChange?: (sobject: string) => void;
}

export function RecordLookupCombobox({
  sobjects,
  comboboxProps,
  typeaheadProps,
  value,
  org,
  allowManualMode,
  manualModeInputProps,
  onChange,
  onObjectChange,
}: RecordLookupComboboxProps) {
  const [key, setKey] = useState(() => Date.now());
  const id = useId();
  const selectedObjectMetadata = useRef<{ sobject: string; nameField: string; keyPrefix?: Maybe<string> } | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(INPUT_MODE_LOOKUP);
  const [selectedSObject, setSelectedSObject] = useState(sobjects[0]);
  const [records, setRecords] = useState<ListItem<string, any>[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ListItem<string, any> | null>(null);
  const selectedSObjectDescribeRef = useRef<Maybe<DescribeGlobalSObjectResult>>(null);
  const selectedSObjectRef = useRef(selectedSObject);
  selectedSObjectRef.current = selectedSObject;

  // on initial load, if there is a value set - then we want to detect which object to auto-select
  useEffect(() => {
    if (!value || (value.length !== 15 && value.length !== 18)) {
      return;
    }
    (async () => {
      try {
        const keyPrefix = value.substring(0, 3);
        const describeGlobalResults = await describeGlobal(org);
        const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
        const foundObject = sobjects.find((obj) => obj === sobject?.name);
        selectedSObjectDescribeRef.current = sobject;
        if (foundObject) {
          setSelectedSObject(foundObject);
          setKey(Date.now());
        }
      } catch (ex) {
        logger.warn('Error searching records', ex);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(
    async (searchTerm: string, sobject = selectedSObject) => {
      searchTerm = (searchTerm || '').trim();
      setSelectedRecord(null);
      try {
        if (!sobject) {
          setRecords([]);
          return;
        }
        // "Name" is always blank for Group object, so we need to special case it
        // If more special cases are needed in the future, we can extract and expand this logic
        if (sobject === 'Group') {
          selectedObjectMetadata.current = {
            sobject,
            nameField: 'DeveloperName',
            keyPrefix: '0F9',
          };
        }
        if (!selectedObjectMetadata.current || selectedObjectMetadata.current.sobject !== sobject) {
          const sobjectDescribe = await describeSObject(org, sobject).then((result) => result.data);

          selectedObjectMetadata.current = {
            sobject,
            nameField: sobjectDescribe.fields.find((field) => field.nameField)?.name || 'Name',
            keyPrefix: sobjectDescribe?.keyPrefix,
          };
        }
        const name = selectedObjectMetadata.current.nameField;

        let soql = `SELECT Id, ${name} FROM ${sobject} ORDER BY ${name} LIMIT 50`;
        if (searchTerm) {
          if (searchTerm.length === 15 || searchTerm.length === 18) {
            soql = `SELECT Id, ${name} FROM ${sobject} WHERE Id = '${searchTerm}' OR ${name} LIKE '%${searchTerm}%' ORDER BY ${name} LIMIT 50`;
          } else {
            soql = `SELECT Id, ${name} FROM ${sobject} WHERE ${name} LIKE '%${searchTerm}%' ORDER BY ${name} LIMIT 50`;
          }
        }

        if (sobject !== selectedSObjectRef.current) {
          return;
        }

        const { queryResults } = await query(org, soql);

        if (sobject !== selectedSObjectRef.current) {
          return;
        }

        setRecords([
          {
            id: '',
            label: SFDC_BLANK_PICKLIST_VALUE,
            value: '',
          },
          ...queryResults.records.map((record) => ({
            id: record.Id,
            label: record[name] || record.Id,
            secondaryLabel: record[name] ? record.Id : undefined,
            secondaryLabelOnNewLine: true,
            value: record.Id,
          })),
        ]);
      } catch (ex) {
        logger.warn('Error searching records', ex);
        setRecords([]);
      }
    },
    [org, selectedSObject],
  );

  if (inputMode === INPUT_MODE_MANUAL) {
    return (
      <Input
        key={key}
        id={id}
        label={comboboxProps.label}
        hideLabel={comboboxProps.hideLabel}
        className={comboboxProps.className}
        formControlStyles={css`
          display: flex;
          max-height: 2rem;
        `}
        errorMessage={comboboxProps.errorMessage}
        labelHelp={comboboxProps.labelHelp}
        helpText={comboboxProps.helpText}
        isRequired={comboboxProps.isRequired}
        hasError={comboboxProps.hasError}
        errorMessageId={`${id}-error`}
        clearButton={!!comboboxProps.onClear}
        trailingChildren={
          <FormGroupDropdown
            className="slds-m-bottom_x-small"
            comboboxId={id}
            label={INPUT_MODE_LABEL}
            initialSelectedItemId={inputMode}
            items={INPUT_MODE_OPTIONS}
            headingLabel={INPUT_MODE_LABEL}
            variant="end"
            iconOnly
            onSelected={(value) => setInputMode(value.id as InputMode)}
          />
        }
        onClear={comboboxProps.onClear}
      >
        <input
          id={id}
          className="slds-input"
          css={css`
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            border-top-left-radius: 4px;
            border-bottom-left-radius: 4px;
          `}
          required={comboboxProps.isRequired}
          disabled={comboboxProps.disabled}
          value={value || ''}
          onChange={(ev) => onChange(ev.target.value || null)}
          aria-describedby={comboboxProps.hasError ? `${id}-error` : undefined}
          maxLength={18}
          inputMode="text"
          placeholder={
            selectedObjectMetadata.current?.keyPrefix
              ? `${selectedObjectMetadata.current.keyPrefix}... - ${selectedObjectMetadata.current.sobject} Id`
              : undefined
          }
          {...manualModeInputProps}
        />
      </Input>
    );
  }

  return (
    <ComboboxWithItemsTypeAhead
      key={key}
      comboboxProps={{
        leadingDropdown:
          sobjects.length > 1
            ? {
                label: 'Object',
                initialSelectedItemId: selectedSObject,
                items: sobjects.map((sobject) => ({ id: sobject, label: sobject, value: sobject })),
                headingLabel: 'Related Objects',
                onSelected: (item) => {
                  const sobject = item.id || sobjects[0];
                  setSelectedSObject(sobject);
                  setRecords([]);
                  setSelectedRecord(null);
                  onChange(null);
                  setTimeout(() => handleSearch('', sobject), 0);
                  if (onObjectChange && item.id) {
                    onObjectChange(item.id);
                  }
                },
              }
            : undefined,
        trailingDropdown: allowManualMode
          ? {
              label: INPUT_MODE_LABEL,
              headingLabel: INPUT_MODE_LABEL,
              initialSelectedItemId: inputMode,
              items: INPUT_MODE_OPTIONS,
              iconOnly: true,
              onSelected: (value) => setInputMode(value.id as InputMode),
            }
          : undefined,
        ...comboboxProps,
      }}
      selectedItemLabelFn={(item) => (item.label !== item.id ? `${item.label} (${item.id})` : item.label)}
      selectedItemTitleFn={(item) => (item.label !== item.id ? `${item.label} - ${item.id}` : item.label)}
      {...typeaheadProps}
      items={records}
      onSearch={handleSearch}
      selectedItemId={selectedRecord?.id || value}
      onSelected={(item) => onChange(item?.value || null)}
    />
  );
}
