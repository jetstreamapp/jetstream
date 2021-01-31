import { ColDef, GetQuickFilterTextParams, ValueFormatterParams } from '@ag-grid-community/core';
import { getMetadataLabelFromFullName, ListMetadataResultItem } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { orderStringsBy } from '@jetstream/shared/utils';
import { ListMetadataResult, MapOf } from '@jetstream/types';
import { DateFilterComparator, getCheckboxColumnDef } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { composeQuery, getField, Query } from 'soql-parser-js';
import { DeployMetadataTableRow } from '../deploy-metadata.types';

export function getDeploymentStatusUrl(id: string) {
  // double encode retUrl
  const address = encodeURIComponent(
    `/changemgmt/monitorDeploymentsDetails.apexp?asyncId=${id}&retURL=${encodeURIComponent('/changemgmt/monitorDeployment.apexp')}`
  );
  return `/lightning/setup/DeployStatus/page?address=${address}`;
}

export function getQueryForUsers(): string {
  const query: Query = {
    fields: [getField('Id'), getField('Name'), getField('FirstName'), getField('LastName'), getField('Username'), getField('IsActive')],
    sObject: 'User',
    orderBy: [
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
  };
  const soql = composeQuery(query);
  logger.log('getQueryForUsers()', soql);
  return soql;
}

export function getQueryForPackage(): string {
  const query: Query = {
    fields: [getField('Id'), getField('Name'), getField('Description'), getField('IsManaged'), getField('Source'), getField('Status')],
    sObject: 'Project',
    orderBy: [
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
    where: {
      left: {
        field: 'IsManaged',
        operator: '=',
        value: 'FALSE',
        literalType: 'BOOLEAN',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'Status',
          operator: '=',
          value: 'ACTIVE',
          literalType: 'STRING',
        },
      },
    },
  };
  const soql = composeQuery(query);
  logger.log('getQueryForPackage()', soql);
  return soql;
}

export const dataTableDateFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  if (value instanceof Date) {
    return formatDate(value, DATE_FORMATS.yyyy_MM_dd);
  }
  return '';
};

export function getColumnDefinitions(): ColDef[] {
  const output: ColDef[] = [
    getCheckboxColumnDef(),
    {
      headerName: 'Metadata Type',
      colId: 'typeLabel',
      field: 'typeLabel',
      width: 200,
    },
    {
      headerName: 'Name',
      colId: 'fullName',
      field: 'fullName',
      cellRenderer: 'valueOrLoading',
      width: 200,
    },
    {
      headerName: 'Last Modified By',
      colId: 'lastModifiedByName',
      field: 'lastModifiedByName',
      width: 160,
    },
    {
      headerName: 'Last Modified',
      colId: 'lastModifiedDate',
      field: 'lastModifiedDate',
      width: 145,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: DateFilterComparator,
      },
    },
    {
      headerName: 'Created By',
      colId: 'createdByName',
      field: 'createdByName',
      width: 150,
    },
    {
      headerName: 'Created',
      colId: 'createdDate',
      field: 'createdDate',
      width: 120,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: DateFilterComparator,
      },
    },
  ];

  return output;
}

export function getRows(listMetadataItems: MapOf<ListMetadataResultItem>): DeployMetadataTableRow[] {
  const output: DeployMetadataTableRow[] = [];

  orderStringsBy(Object.keys(listMetadataItems)).forEach((metadataType) => {
    const { type, error, folder, items, lastRefreshed, loading } = listMetadataItems[metadataType];
    const typeLabel = getMetadataLabelFromFullName(type);
    // TODO: what about a full-width row for metadata?
    // loading would be nice
    // we could tell users there are no items
    // we could tell user when last refresh was and allow refresh?
    // but sorting is crazy
    if (loading || error) {
      output.push({
        key: metadataType,
        loading,
        lastRefreshed,
        error,
        type,
        typeLabel,
        folder,
      });
    } else if (items.length > 0) {
      items.forEach((metadata) => {
        const { fullName, lastModifiedByName, lastModifiedDate, createdByName, createdDate } = metadata;
        output.push({
          key: `${metadataType}-${fullName}`,
          loading,
          lastRefreshed,
          error,
          type,
          typeLabel,
          folder,
          fullName,
          lastModifiedByName,
          lastModifiedDate,
          createdByName,
          createdDate,
          metadata,
        });
      });
    } else {
      // FIXME: empty row - should we tell user there are no items? Should we just show as a summary somewhere?
      // Should we have a full-width row for each metadata type? (makes sorting crazy)
      output.push({
        key: metadataType,
        loading,
        lastRefreshed,
        error,
        type,
        typeLabel,
        folder,
      });
    }
  });

  return output;
}

export function convertRowsToMapOfListMetadataResults(rows: DeployMetadataTableRow[]): MapOf<ListMetadataResult[]> {
  return rows.reduce((output: MapOf<ListMetadataResult[]>, row) => {
    if (row.metadata) {
      output[row.type] = output[row.type] || [];
      output[row.type].push(row.metadata);
    }
    return output;
  }, {});
}
