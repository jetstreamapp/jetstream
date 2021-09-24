---
id: query
title: Query
sidebar_label: Query
slug: /query
---

import FilterIcon from './assets/icons/Filter.svg';

Jetstream's query functionality provides an easy and powerful way to view your record data and even metadata records, like Validation Rules.

:::tip

Not only is the query builder great for viewing record data, but is also a great place to view your objects and fields along with a ton of useful information like field API names, picklist values, field dependencies and more.

:::

## Basic query

1. Select the object that you would like to work with
2. Choose the fields that you would like to include in your query
3. Optionally add
   1. Filters that will limit the records
   2. ORder by to change the order of the records
   3. Limit to limit the number of records
4. Click execute

You have run your first query! 🎉

Jetstream is designed to be fast and easy to run queries without having to schedule tasks and wait for things to finish. Click to Go Back to run another query.

## Query configuration

### Fields

#### Selecting related fields

Jetstream allows you to include related records through up to 6 relationships.
To include related fields, find a related field, such as Created By Id, and click **View User Fields**.

#### Field quick filters

Click the filter icon <FilterIcon class="icon" /> to open up the quick filter.

From here, you can quickly change which fields are visible to select using one of the following options:

- All Fields
- Creatable Fields
- Updateable Fields
- Custom Fields
- Non-Managed Fields
- Non-Managed Custom Fields
- Selected Fields

#### Selecting children objects (Related Lists)

Click the **Related Objects (Subquery)** tab to show all the child objects.
Any object that has a lookup field to the current object will show up in this list, just like Related Lists show up in Salesfroce.

### Filters

:::tip

Related fields only show up in the fields if you have checked the field to be included in the query.

:::

Filters allow you to limit which records are returned from Salesforce.

- **Filter When all conditions are met** requires all conditions to be true **AND**
- **Filter When any conditions are met** requires at least one condition to be true **OR**
- _You can use groups to mix and match AND and OR conditions._

Choose the field, operator, and value to complete the filter.

Depending on which field you select, the value may change to give additional configuration options. For example, if you choose a Date you use a date picker

:::tip

- If you want to find records from a specific date range, use **Relative Values** to keep things simple, or use greater than or less than with the date picker.
- If you want to filter against a list of values, such as a list of Ids or Product Codes, use the **IN** or **NOT IN** operator.
- To see if specific values in a multi-select picklist are checked, use the **Includes** or **Excludes** filters.

:::

## Query history

Jetstream will save your recent queries so you can easily execute them again in the future. Click the Query History button to view your history.

You can save queries that you want to be able to find easily in the future, click the Plus icon to save the query.

From query history you can choose either **Restore** or **Execute**.

Restore will configure the query page with all the checkboxes and filters configured just like the first time you executed the query so that you can easily start where you left off and make changes.
If there are any parts of the query that could not be restored, you will be notified.

Executing the query will run it and show the results.

## Manual query

If you have a SOQL query and you want to use that on the Query builder, then you click the **Manual Query** button at the top of the page and paste in your query and **restore** or **execute**.

## Querying metadata records

:::danger

TODO:

:::

## Query results

:::danger

TODO: Should this be a stand-aline page?

:::
