---
id: update-records
title: Update records
description: Update fields on records without loading a data file.
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
    update record,
    picklist,
    external id,
  ]
sidebar_label: Update records in bulk
slug: /load/update-records
---

With Jetstream, you can make updates to many records across many objects at the same time without performing individual data loads.

This is useful if you want to mass update picklist fields or populate custom external id fields across many objects.

## Object and Field Configuration

The first thing you need to do is select one or more objects that you would like to update records for. In many cases you will only select one object, but sometimes you may need to update records on many objects at the same time.

<img src={require('./update-records-config-initial.png').default} alt="Initial field update configuration" />

After selecting an object, you need to configure the fields that you would like to update and on which records would you like to updates to be made.

- **Field to Update** is the field on the record you want to update.
- **New Value** Allows you to choose how you want to update the field.
  - **Value from a different field** allows you to copy the value from a field into the field to update, for example, copying the record id to an external id field.
  - **Provided value** allows you to provide any value that you want to update the field with. For example, you could update a picklist field to a new value on all existing records.
  - **Clear field value** allows you to remove the existing value in the field across many records.
- **Criteria** determines which records will be modified.
  - **All records**
  - **Only if blank**
  - **Only if not blank**
  - **Customer criteria** allows you to provide a custom `soql` WHERE clause to target the exact records you want. If you are unfamiliar with doing this by hand, you can use the Query Builder to build this for you.

After you have configured your field, you will need to validate the results. Validating the results will make sure your configuration is accurate and let you know how many records will be modified with this change.

If you have specified a custom criteria that is not valid, Salesforce will return an error message. You will need to resolve this before continuing.

:::tip

Always make sure the number of records shown matches your expectation of what records will be updated.

:::

<img src={require('./update-records-config-validated.png').default} alt="Validated configuration" />

### Updating multiple objects at the same time

If you have selected more than one object, you will notice a section appear at the top of the page where you can update the options for all the objects at once to save time.

If all of your selected objects have a field with the same API name, then you will be able to select the field and apply to all objects.

In addition, you can update the new value configuration and the criteria configuration and apply to all selected objects.

:::tip

Many people use external id fields to make data migrations easier because you are able to load records and use the external id field of a related record to establish the relationship without knowing the actual record id.

To accomplish this, you need the external id field to have a known value on all records. The easiest way to solve this is to set the external id field to the record id in the lowest environment (e.x. dev).

Make sure all your objects that need to be migrated have a field with the same API name (e.x. `External_Id__c`) and you can use Jetstream to easily update all the records.

:::

<img src={require('./update-records-multiple-fields.png').default} alt="Updating multiple objects at once" />

## Perform record updates

Once your objects are configured and validated, click **Review Changes** to continue to the next page.

You will see a list of objects that are going to be updated, make sure everything looks accurate before clicking **Update Records**.

<img src={require('./update-records-load.png').default} alt="Perform record update summary overview" />

### Data Load Configuration

Jetstream will load your records to Salesforce using the Salesforce Bulk API.

- **Serial Mode** - By default, Salesforce will process your records in parallel. If this causes issues with record locks, you can try Serial Mode.
- **Batch Size** - This setting controls how many records will be updated in one transaction. Normally the default of 10,000 is fine, but if you are hitting CPU timeouts you can lower this to a very low number.

:::note

Salesforce has a 24-limit of 10,000 batches across all jobs that use the Bulk API.

:::

### Record Update Results

To update the records in Salesforce, choose **Update Records** to begin the record update process.

Jetstream will process one object at a time by obtaining all the records from Salesforce, transforming the data, and re-loading the results back to Salesforce.

After all the records have been submitted to Salesforce, then Jetstream will monitor each job until it completes. You can also view the bulk jobs in the Salesforce setup menu.

From here, you can view or download the results for each object. If you need to attempt the data load again, for example after disabling a validation rule, you can click **Update Records** again to re-run the process. Depending on the criteria you configured and if some records were initially successful, there may be fewer records processed on subsequent updates.

<img src={require('./update-records-load-results.png').default} alt="Record update results" />
