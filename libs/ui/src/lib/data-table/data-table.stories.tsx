import { action } from '@storybook/addon-actions';
import React from 'react';
import DataTable from './DataTable';

export default {
  component: DataTable,
  title: 'DataTable',
};

const rows = [];
const columns = [
  'Id',
  'Name',
  'Description',
  'Fax',
  'AccountNumber',
  'Phone',
  'Rating',
  'Site',
  'AccountSource',
  'Type',
  'Active',
  'Churned',
].map((field) => ({
  accessor: field,
  Header: () => (
    <div className="slds-truncate" title={field}>
      {field}
    </div>
  ),
  Cell: ({ value }) => (
    <div className="slds-truncate" title={value}>
      {value}
    </div>
  ),
}));

for (let i = 0; i < 50; i++) {
  rows.push({
    Id: i,
    Name: `my account ${i}`,
    Description: `Some description for account ${i}`,
    Fax: null,
    AccountNumber: 123456 + i,
    Phone: null,
    Rating: 'A+',
    Site: null,
    AccountSource: null,
    Type: 'Other',
    Active: true,
    Churned: false,
  });
}

export const base = () => <DataTable columns={columns} data={rows} />;

export const rowSelection = () => <DataTable columns={columns} data={rows} allowRowSelection onRowSelection={action('onRowSelection')} />;
