import { SalesforceOrgUi } from '@jetstream/types';
import { DatePicker, Grid } from '@jetstream/ui';
import { OrgsCombobox } from '@jetstream/ui-core';
import { DataHistoryListFilter } from '@jetstream/ui/db';
import { endOfDay, startOfDay } from 'date-fns';
import { FunctionComponent, useMemo } from 'react';

/** The user-editable part of the list query — the page adds the page-size `limit` itself */
export type DataHistoryFilterValue = Omit<DataHistoryListFilter, 'limit'>;

export interface DataHistoryFiltersProps {
  orgs: SalesforceOrgUi[];
  value: DataHistoryFilterValue;
  onChange: (value: DataHistoryFilterValue) => void;
}

export const DataHistoryFilters: FunctionComponent<DataHistoryFiltersProps> = ({ orgs, value, onChange }) => {
  const selectedOrg = useMemo(() => orgs.find(({ uniqueId }) => uniqueId === value.org) ?? null, [orgs, value.org]);

  return (
    <Grid verticalAlign="end" wrap className="slds-m-bottom_x-small slds-gutters_xx-small">
      <div className="slds-col slds-m-right_x-small">
        <OrgsCombobox
          label="Org"
          hideLabel={false}
          orgs={orgs}
          selectedOrg={selectedOrg}
          onSelected={(org) => onChange({ ...value, org: org.uniqueId })}
          onSelectedAllOrgs={() => onChange({ ...value, org: undefined })}
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
