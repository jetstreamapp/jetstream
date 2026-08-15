import { InsertUpdateUpsert, Maybe } from '@jetstream/types';
import { Grid, Icon, Popover, PopoverRef, Select } from '@jetstream/ui';
import { useAtomValue, useSetAtom } from 'jotai';
import { FunctionComponent, useRef, useState } from 'react';
import { LoadMultiObjectData } from '../load-records-multi-object-types';
import { applyDatasetConfiguration } from '../load-records-multi-object-utils';
import { datasetsState, loadIsRunningState } from '../load-records-multi-object.state';
import { getWorksheetElementId } from './review-utils';

const OPERATIONS: { value: InsertUpdateUpsert; label: string }[] = [
  { value: 'INSERT', label: 'Insert' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'UPSERT', label: 'Upsert' },
];

export interface LoadRecordsMultiObjectSheetConfigProps {
  dataset: LoadMultiObjectData;
}

/**
 * The object/operation summary for one worksheet, with an editor for the values from cells B2/B3.
 * Saving replaces the dataset in state, which re-validates the worksheet and re-derives the record groups.
 */
export const LoadRecordsMultiObjectSheetConfig: FunctionComponent<LoadRecordsMultiObjectSheetConfigProps> = ({ dataset }) => {
  const setDatasets = useSetAtom(datasetsState);
  const loadIsRunning = useAtomValue(loadIsRunningState);
  const popoverRef = useRef<PopoverRef>(null);

  const [operation, setOperation] = useState<InsertUpdateUpsert>(dataset.operation);
  const [externalId, setExternalId] = useState<Maybe<string>>(dataset.externalId);

  const externalIdFields = (dataset.metadata?.fields || []).filter((field) => field.externalId);
  const hasConfigChanges = operation !== dataset.operation || (operation === 'UPSERT' && externalId !== dataset.externalId);

  function handleOpenChange(isOpen: boolean) {
    // Discard anything the user typed but did not save
    if (isOpen) {
      setOperation(dataset.operation);
      setExternalId(dataset.externalId);
    }
  }

  function handleSave() {
    setDatasets(
      (priorDatasets) =>
        priorDatasets?.map((item) =>
          item.worksheet === dataset.worksheet ? applyDatasetConfiguration(item, { operation, externalId }) : item,
        ) || null,
    );
    popoverRef.current?.close();
  }

  return (
    <Grid verticalAlign="center">
      <span className="slds-text-color_weak">
        {dataset.sobject} • {dataset.operation}
        {dataset.operation === 'UPSERT' && dataset.externalId ? ` (${dataset.externalId})` : ''}
      </span>
      <Popover
        ref={popoverRef}
        placement="bottom-start"
        header={
          <header className="slds-popover__header">
            <h2 className="slds-text-heading_small">{dataset.worksheet} Options</h2>
          </header>
        }
        content={
          <div>
            <Select id={getWorksheetElementId('operation', dataset.worksheet)} label="Operation">
              <select
                className="slds-select"
                id={getWorksheetElementId('operation-select', dataset.worksheet)}
                value={operation}
                disabled={loadIsRunning}
                onChange={(event) => setOperation(event.target.value as InsertUpdateUpsert)}
              >
                {OPERATIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Select>
            {operation === 'UPSERT' && (
              <Select
                id={getWorksheetElementId('external-id', dataset.worksheet)}
                label="External Id"
                labelHelp="Records are matched on this field, which must also be one of the columns in your file."
              >
                <select
                  className="slds-select"
                  id={getWorksheetElementId('external-id-select', dataset.worksheet)}
                  value={externalId || ''}
                  disabled={loadIsRunning}
                  onChange={(event) => setExternalId(event.target.value || null)}
                >
                  <option value="">-- Select External Id --</option>
                  {externalIdFields.map(({ name, label }) => (
                    <option key={name} value={name}>
                      {label} ({name})
                    </option>
                  ))}
                </select>
              </Select>
            )}
            {operation === 'UPSERT' && !externalIdFields.length && (
              <p className="slds-text-color_error slds-m-top_x-small">
                {dataset.sobject} has no external Id fields, or you do not have access to them.
              </p>
            )}
          </div>
        }
        footer={
          <footer className="slds-popover__footer slds-grid slds-grid_align-end">
            <button className="slds-button slds-button_brand" disabled={!hasConfigChanges || loadIsRunning} onClick={handleSave}>
              Save
            </button>
          </footer>
        }
        buttonProps={{
          className: 'slds-button slds-button_icon slds-button_icon-small slds-m-left_xx-small',
          title: 'Change the object operation for this worksheet',
        }}
        onChange={handleOpenChange}
      >
        <Icon type="utility" icon="settings" className="slds-button__icon" omitContainer />
        <span className="slds-assistive-text">Worksheet options</span>
      </Popover>
    </Grid>
  );
};

export default LoadRecordsMultiObjectSheetConfig;
