---
id: load-with-related
title: Load Related Records
description: Load records to multiple objects at the same time while setting relationships between records.
keywords:
  [
    salesforce,
    salesforce admin,
    salesforce developer,
    salesforce automation,
    salesforce workbench,
    salesforce metadata,
    soql,
    apex,
    salesforce api,
    data load,
    related records,
    update records,
  ]
sidebar_label: Load Related Records
slug: /load/with-related
---

Jetstream allows you to load records to multiple objects with automatic relationships.

**Example**: You want to insert new accounts and new contacts and you want to set the lookup field on the Contacts to the newly inserted Accounts.

Normally this would require two data loads and you would need to use External Ids or Excel vlookups to prepare the Contact file.

## Preparing your load file

:::tip

Download the example Excel template from the top of the page to get started. The template has instructions with examples.

:::

The data load template has a section at the top where you will enter the **Object Api Name**, **Operation**, and optionally the **External Id**.

Your record data starts on Row 5, and the first column is required to be a temporary unique identifier of your choosing for each record. If you are exporting data as a starting point, set the **Reference Id** as the record id of the org where you exported the data. This Id is only used for the load process.

Create a new worksheet and repeat the process for any related records.

For any relationship fields, like the **AccountId** from the example above, wrap the column header in curly brackets, like this `{AccountId}`, to indicate that the values in this column are reference Ids from other records in the file. All the values in that column must map to a value in the **Reference Id** column in the current or another worksheet.

<img src={require('./load-related-example-1.png').default} alt="Load results" />

:::tip

Prepare data sheets quickly using the Query page to download records

- Use the **Record Id** as the **Reference Id**. (See example template for an example)
- For related records, the lookup field will already contain the parent Record Id, which is the **Reference Id**, so you don't need to change anything in your data.

:::

## Previewing your data

When you upload your file, Jetstream will calculate all the relationships and will perform validations to ensure that there are no errors with your file.

Jetstream will show a preview of all the groups of related records prior to being loaded into Salesforce. These may not be in the same order as your file depending on the calculated dependency graph.

<img src={require('./load-related-group-modal.png').default} alt="Load groups" />

### Resolving errors

If you have errors with your file, you will be presented with detailed information for all the problems in the file and which cell(s) the problem was detected in.

<img src={require('./load-related-errors.png').default} alt="Load errors" />

## Loading into Salesforce

When you load your data, if any record in a given group fails, the entire group will be rolled back.

After the load is finished, you will be able to view and download the results.
