import { css } from '@emotion/react';
import { ApexLogWithViewed } from '@jetstream/types';
import { AutoFullHeightContainer, DataTableNew, Icon } from '@jetstream/ui';
import { ColumnWithFilter } from 'libs/ui/src/lib/data-table-new/data-table-types';
import { setColumnFromType } from 'libs/ui/src/lib/data-table-new/data-table-utils';
import { FunctionComponent, useEffect, useRef } from 'react';
import { FormatterProps } from 'react-data-grid';

export const LogViewedRenderer: FunctionComponent<FormatterProps<ApexLogWithViewed>> = ({ row }) => {
  if (row?.viewed) {
    return (
      <Icon
        css={css`
          margin-left: 24px;
        `}
        type="utility"
        icon="preview"
        className="slds-icon slds-icon-text-default slds-icon_xx-small"
        title="You have previously viewed this log"
        description="This log has been viewed"
      />
    );
  }
  return null;
};

const COLUMNS: ColumnWithFilter<ApexLogWithViewed>[] = [
  {
    name: '',
    key: 'viewed',
    width: 12,
    formatter: LogViewedRenderer,
    resizable: false,
    // TODO: filter for this
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'User',
    key: 'LogUser.Name',
    width: 125,
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'Application',
    key: 'Application',
    width: 125,
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'Operation',
    key: 'Operation',
    width: 125,
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'Status',
    key: 'Status',
    width: 125,
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'Size',
    key: 'LogLength',
    width: 125,
  },
  {
    ...setColumnFromType('LastModifiedDate', 'date'),
    name: 'Time',
    key: 'LastModifiedDate',
    // sort: 'desc',
    width: 202,
    // valueFormatter: dataTableDateFormatter,
    // getQuickFilterText: dataTableDateFormatter,
    // filter: 'agDateColumnFilter',
    // filterParams: {
    // defaultOption: 'greaterThan',
    // comparator: DateFilterComparator,
    // buttons: ['clear'],
    // },
  },
];

function getRowId({ Id }: ApexLogWithViewed): string {
  return Id;
}

export interface DebugLogViewerTableProps {
  logs: ApexLogWithViewed[];
  onRowSelection: (log: ApexLogWithViewed) => void;
}

export const DebugLogViewerTable: FunctionComponent<DebugLogViewerTableProps> = ({ logs, onRowSelection }) => {
  const isMounted = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleSelectionChanged(row: ApexLogWithViewed, column: ColumnWithFilter<ApexLogWithViewed>) {
    if (row) {
      onRowSelection(row);
    }
  }

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={75}>
      <DataTableNew columns={COLUMNS} data={logs} getRowKey={getRowId} onRowClick={handleSelectionChanged} />
    </AutoFullHeightContainer>
  );
};

export default DebugLogViewerTable;
