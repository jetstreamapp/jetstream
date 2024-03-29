import { Meta, Story } from '@storybook/react';
import DataTable, { DataTableNewProps } from './DataTable';

export default {
  component: DataTable,
  title: 'DataTable',
  argTypes: {
    columns: {
      control: false,
    },
    data: {
      control: false,
    },
  },
} as Meta;

// const columns: ColDef[] = [
//   getCheckboxColumnDef(),
//   {
//     headerName: 'Id',
//     field: 'Id',
//     cellRenderer: 'idLinkRenderer',
//   },
//   {
//     headerName: 'Name',
//     field: 'Name',
//   },
//   {
//     headerName: 'MailingAddress',
//     field: 'MailingAddress',
//     wrapText: true,
//     autoHeight: true,
//     valueFormatter: dataTableAddressFormatter,
//   },
//   {
//     headerName: 'Account.Description',
//     field: 'Account.Description',
//   },
//   {
//     headerName: 'Account.Id',
//     field: 'Account.Id',
//     cellRenderer: 'idLinkRenderer',
//   },
//   {
//     headerName: 'Account.Name',
//     field: 'Account.Name',
//   },
//   {
//     headerName: 'Account.BillingAddress',
//     field: 'Account.BillingAddress',
//     wrapText: true,
//     autoHeight: true,
//     valueFormatter: dataTableAddressFormatter,
//   },
//   {
//     headerName: 'Account.Description',
//     field: 'Account.Description',
//   },
//   {
//     headerName: 'AccountId',
//     field: 'AccountId',
//     cellRenderer: 'idLinkRenderer',
//   },
//   {
//     headerName: 'Email',
//     field: 'Email',
//   },
//   {
//     headerName: 'Cases',
//     field: 'Cases',
//     cellRenderer: 'subqueryRenderer',
//     filter: false,
//   },
// ];

const Template: Story<DataTableNewProps> = (args) => (
  <div style={{ height: 700 }}>{/* <DataTable columns={columns} data={data} {...args} /> */}</div>
);

export const Base = Template.bind({});
