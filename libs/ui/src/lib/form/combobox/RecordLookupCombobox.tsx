/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { describeGlobal, describeSObject, query } from '@jetstream/shared/data';
import { DescribeGlobalSObjectResult, FormGroupDropdownItem, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField, Query } from '@jetstreamapp/soql-parser-js';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { FormGroupDropdown } from '../formGroupDropDown/FormGroupDropdown';
import Input from '../input/Input';
import { ComboboxSharedProps } from './Combobox';
import ComboboxWithItemsTypeAhead, { ComboboxWithItemsTypeAheadProps } from './ComboboxWithItemsTypeAhead';

const INPUT_MODE_LABEL = 'Input Mode';
export const INPUT_MODE_LOOKUP = 'LOOKUP';
export const INPUT_MODE_MANUAL = 'MANUAL';

const InputModeSchema = z.enum([INPUT_MODE_LOOKUP, INPUT_MODE_MANUAL]);

const INPUT_MODE_OPTIONS: FormGroupDropdownItem[] = [
  { id: INPUT_MODE_LOOKUP, label: 'Lookup', icon: 'record_lookup' },
  { id: INPUT_MODE_MANUAL, label: 'Manual Entry', icon: 'text' },
];
type InputMode = typeof INPUT_MODE_LOOKUP | typeof INPUT_MODE_MANUAL;

const getDefaultValue = (allowManualMode?: boolean) => {
  if (!allowManualMode) {
    return INPUT_MODE_LOOKUP;
  }
  try {
    const parsedValue = InputModeSchema.parse(localStorage.getItem('RecordLookupCombobox.inputMode'));
    return parsedValue;
  } catch {
    return INPUT_MODE_LOOKUP;
  }
};

const setDefaultValue = (inputMode: InputMode) => {
  try {
    localStorage.setItem('RecordLookupCombobox.inputMode', InputModeSchema.parse(inputMode));
  } catch {
    // could not save default value
  }
};

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
  const autoFocusRef = useRef(false);
  const selectedObjectMetadata = useRef<{ sobject: string; nameField: string; keyPrefix?: Maybe<string> } | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(() => getDefaultValue(allowManualMode));
  const [selectedSObject, setSelectedSObject] = useState(sobjects[0]);
  const [records, setRecords] = useState<ListItem<string, any>[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ListItem<string, any> | null>(null);
  const selectedSObjectDescribeRef = useRef<Maybe<DescribeGlobalSObjectResult>>(null);
  const selectedSObjectRef = useRef(selectedSObject);
  selectedSObjectRef.current = selectedSObject;
  // The record whose label must remain visible: resolved from the initial value on load (or a synthetic
  // raw-Id fallback), then updated as the user changes selection. Always merged into `records` because
  // each search only fetches the first 50 records, which may not include the selected record.
  const pinnedRecordRef = useRef<ListItem<string, any> | null>(null);

  // Resolves and caches the object's name field (special casing Group, whose Name is always blank)
  const ensureObjectMetadata = useCallback(
    async (sobject: string) => {
      if (sobject === 'Group') {
        selectedObjectMetadata.current = { sobject, nameField: 'DeveloperName', keyPrefix: '00G' };
      }
      if (!selectedObjectMetadata.current || selectedObjectMetadata.current.sobject !== sobject) {
        const sobjectDescribe = await describeSObject(org, sobject).then((result) => result.data);
        selectedObjectMetadata.current = {
          sobject,
          nameField: sobjectDescribe.fields.find((field) => field.nameField)?.name || 'Name',
          keyPrefix: sobjectDescribe?.keyPrefix,
        };
      }
      return selectedObjectMetadata.current;
    },
    [org],
  );

  // Called when an initial value cannot be resolved to a record (no access, deleted, or its object
  // is not one of the allowed lookup objects). Falls back to manual entry, or shows the raw Id.
  const handleUnresolvedValue = useCallback(() => {
    if (!value) {
      return;
    }
    if (allowManualMode) {
      // Automatic, value-driven fallback - intentionally not persisted to localStorage
      setInputMode(INPUT_MODE_MANUAL);
      return;
    }
    // Without manual mode, inject a synthetic item so the combobox shows the raw Id instead of appearing empty
    const syntheticItem: ListItem<string, any> = {
      id: value,
      label: value,
      value,
      meta: { sobject: selectedSObjectRef.current },
    };
    pinnedRecordRef.current = syntheticItem;
    setRecords([{ id: '', label: SFDC_BLANK_PICKLIST_VALUE, value: '' }, syntheticItem]);
  }, [allowManualMode, value]);

  // On initial load, if there is a value set, detect which object to auto-select and explicitly fetch
  // the record by Id so its label can be shown even when it falls outside the first 50 search results.
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

        if (!foundObject) {
          handleUnresolvedValue();
          return;
        }

        const { nameField } = await ensureObjectMetadata(foundObject);
        const { queryResults } = await query(
          org,
          composeQuery({
            sObject: foundObject,
            fields: [getField('Id'), getField(nameField)],
            where: { left: { field: 'Id', value, literalType: 'STRING', operator: '=' } },
            limit: 1,
          }),
        );
        const record = queryResults.records[0];

        if (!record) {
          handleUnresolvedValue();
          return;
        }

        const initialRecord: ListItem<string, any> = {
          id: record.Id,
          label: record[nameField] || record.Id,
          secondaryLabel: record[nameField] ? record.Id : undefined,
          secondaryLabelOnNewLine: true,
          value: record.Id,
          meta: { sobject: foundObject },
        };
        // Set the ref before remounting so the child's onSearch('') re-merges this record (see handleSearch)
        pinnedRecordRef.current = initialRecord;
        setSelectedRecord(initialRecord);
        setRecords([{ id: '', label: SFDC_BLANK_PICKLIST_VALUE, value: '' }, initialRecord]);
        setSelectedSObject(foundObject);
        setKey(Date.now());
      } catch (ex) {
        logger.warn('Error resolving initial record', ex);
        handleUnresolvedValue();
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
        const { nameField: name } = await ensureObjectMetadata(sobject);

        const soqlQuery: Query = {
          sObject: sobject,
          fields: [getField('Id'), getField(name)],
          orderBy: [{ field: name }],
          limit: 50,
        };
        if (searchTerm) {
          // Escape backslashes so they are treated literally, then escape `%` since it is a LIKE wildcard (composeQuery escapes quotes)
          const likeValue = `%${searchTerm.replace(/\\/g, '\\\\').replace(/%/g, '\\%')}%`;
          const nameCondition = { left: { field: name, operator: 'LIKE', value: likeValue, literalType: 'STRING' } } as const;
          soqlQuery.where =
            searchTerm.length === 15 || searchTerm.length === 18
              ? { left: { field: 'Id', operator: '=', value: searchTerm, literalType: 'STRING' }, operator: 'OR', right: nameCondition }
              : nameCondition;
        }
        const soql = composeQuery(soqlQuery);

        if (sobject !== selectedSObjectRef.current) {
          return;
        }

        const { queryResults } = await query(org, soql);

        if (sobject !== selectedSObjectRef.current) {
          return;
        }

        const mapped = queryResults.records.map((record) => ({
          id: record.Id,
          label: record[name] || record.Id,
          secondaryLabel: record[name] ? record.Id : undefined,
          secondaryLabelOnNewLine: true,
          value: record.Id,
        }));

        // Keep the selected record visible even when it is not within the first 50 results
        const pinnedRecord = pinnedRecordRef.current;
        const merged =
          pinnedRecord && pinnedRecord.meta?.sobject === sobject && !mapped.some((item) => item.id === pinnedRecord.id)
            ? [pinnedRecord, ...mapped]
            : mapped;

        setRecords([{ id: '', label: SFDC_BLANK_PICKLIST_VALUE, value: '' }, ...merged]);
      } catch (ex) {
        logger.warn('Error searching records', ex);
        setRecords([]);
      }
    },
    [org, selectedSObject, ensureObjectMetadata],
  );

  // When the input type changes, we want to focus on the input
  // since it is not in the dom yet, we rely on auto-focus to handle this
  const handleAutoFocus = useCallback(() => {
    autoFocusRef.current = true;
    setTimeout(() => {
      autoFocusRef.current = false;
    }, 100);
  }, []);

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
        trailingChildren={
          <FormGroupDropdown
            comboboxId={id}
            label={INPUT_MODE_LABEL}
            initialSelectedItemId={inputMode}
            items={INPUT_MODE_OPTIONS}
            headingLabel={INPUT_MODE_LABEL}
            variant="end"
            iconOnly
            onSelected={(value) => {
              handleAutoFocus();
              setInputMode(value.id as InputMode);
              setDefaultValue(value.id as InputMode);
            }}
          />
        }
      >
        <input
          id={id}
          className="slds-input"
          css={css`
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            border-top-left-radius: 4px;
            border-bottom-left-radius: 4px;
            &:focus {
              z-index: 1;
            }
          `}
          autoFocus={!!autoFocusRef.current}
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
                  pinnedRecordRef.current = null;
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
              onSelected: (value) => {
                handleAutoFocus();
                setInputMode(value.id as InputMode);
                setDefaultValue(value.id as InputMode);
              },
            }
          : undefined,
        ...comboboxProps,
        inputProps: {
          autoFocus: !!autoFocusRef.current,
          ...comboboxProps?.inputProps,
        },
      }}
      selectedItemLabelFn={(item) => (item.label !== item.id ? `${item.label} (${item.id})` : item.label)}
      selectedItemTitleFn={(item) => (item.label !== item.id ? `${item.label} - ${item.id}` : item.label)}
      {...typeaheadProps}
      items={records}
      onSearch={handleSearch}
      selectedItemId={selectedRecord?.id || value}
      onSelected={(item) => {
        // Pin the new selection (or clear the pin) so prior selections are not re-merged into future search results
        pinnedRecordRef.current = item?.value ? { ...item, meta: { ...item.meta, sobject: selectedSObject } } : null;
        onChange(item?.value || null);
      }}
    />
  );
}
