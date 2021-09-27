---
id: query-results
title: Query Results
sidebar_label: Query Results
slug: /query/results
---

Jetstream offers some really great functionality on the Query Results page.

## Working with records

### Global filter

Use the search input above the list of records to search across all returned records. This is great when you need to find one or more records in the results without updating query query.

### Column filter

In the header of each column is a menu icon, clicking this opens a filter menu that you can use to filter which records are shown.

You can enter free-form text or click the checkboxes to show or hide rows that have a specific value in that column.

:::tip

Column filters can also be adjusted by clicking on the **Filters** side bar on the right-hand section of the table.

:::

<img src={require('./column-filter.png').default} alt="Column filters" />

### Adjusting columns

Clicking the **Columns** button on the right-hand section of the table will open the column menu, where you can show or hide columns.

You can also click any column header in the table and drag it to change the column order.

<img src={require('./column-sidebar.png').default} alt="Column sidebar" />

### Viewing child records (subqueries)

If your query includes a subquery (child records), the data in each row will show text to indicate the number of records associated to each of the returned records and will be blank if there are no child related records.

You can click the number of records to open a modal with each of the child records.

<img src={require('./child-records.png').default} alt="Child records" />

### Record actions (View, update, and clone records)

On the left side of each record, there are four icons.

- The **eye** icon is used to view all the fields for that record.
- The **pencil** icon is used to edit the record.
- The **copy** icon is used to clone the record and you can make any adjustments to fields prior to saving.
- The **code** icon will turn the record into apex code that you can use to create a record that looks just like the on in your query results.

## Adjusting your query

Click the **Manage SOQL Query** button to show a sidebar with your SOQL query. You can easily make changes to your query and resubmit the results

## Query more

If you have a lot of records on an object, Jetstream will only show the first set of records initially. If you want to see more records, you can click the **Load More** button that appears if there are additional records.

:::tip

When you download your records, the default option will be to include all records, not just the initial set.

:::

## Query history

The query history works just like it does on the Query page. Refer to [Query](query.md) page for more details.

## Downloading records

You can download records by clicking the **Download Records** button.

This modal may show different options depending on if there are more records available or if you have records selected.

You can download in the following formats:

- Excel _(Recommended format)_
- CSV
- JSON
- Google Drive

:::warning

If you are using **Windows** and choose **CSV**, non-english special characters will become corrupt if you open the file with Excel.

- If you don't open the file in Excel, the CSV data will not be corrupt.
- If you require a CSV and are on Windows, you can import the CSV into Excel with the UTF-8 option.

:::

<img src={require('./download-modal.png').default} alt="Download records modal" />
