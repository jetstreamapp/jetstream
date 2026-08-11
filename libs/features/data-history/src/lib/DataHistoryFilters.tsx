import { SalesforceOrgUi } from '@jetstream/types';
import { DatePicker, Grid, Picklist } from '@jetstream/ui';
import { endOfDay, startOfDay } from 'date-fns';
import { FunctionComponent, useMemo } from 'react';

/**
 * Server-side (Dexie) narrowing for the history list. Deliberately limited to what the
 * `[org+createdAt]` / `createdAt` indexes can serve — the table's own column filters handle
 * everything else, but they only ever see rows the query already returned.
 */
export interface DataHistoryFilterValue {
  org?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface DataHistoryFiltersProps {
  orgs: SalesforceOrgUi[];
  value: DataHistoryFilterValue;
  onChange: (value: DataHistoryFilterValue) => void;
}

const ALL_ORGS_ID = '__ALL__';

export const DataHistoryFilters: FunctionComponent<DataHistoryFiltersProps> = ({ orgs, value, onChange }) => {
  const orgItems = useMemo(
    () => [
      { id: ALL_ORGS_ID, label: 'All orgs', value: ALL_ORGS_ID },
      ...orgs.map(({ uniqueId, label }) => ({ id: uniqueId, label, value: uniqueId })),
    ],
    [orgs],
  );

  return (
    <Grid verticalAlign="end" wrap className="slds-m-bottom_x-small slds-gutters_xx-small">
      <div className="slds-col slds-m-right_x-small">
        <Picklist
          label="Org"
          containerClassName="slds-size_small"
          items={orgItems}
          selectedItemIds={[value.org ?? ALL_ORGS_ID]}
          allowDeselection={false}
          onChange={([selected]) => onChange({ ...value, org: selected?.id === ALL_ORGS_ID ? undefined : selected?.id })}
        />
      </div>
      <div className="slds-col slds-m-right_x-small">
        <DatePicker
          label="From"
          allowClear
          initialSelectedDate={value.createdAfter}
          // Normalized to day boundaries so a picked day is fully included at both ends — the query
          // bounds are inclusive on the raw `createdAt` timestamp, not on the calendar day
          onChange={(date) => onChange({ ...value, createdAfter: date ? startOfDay(date) : undefined })}
        />
      </div>
      <div className="slds-col">
        <DatePicker
          label="To"
          allowClear
          initialSelectedDate={value.createdBefore}
          minAvailableDate={value.createdAfter}
          onChange={(date) => onChange({ ...value, createdBefore: date ? endOfDay(date) : undefined })}
        />
      </div>
    </Grid>
  );
};
