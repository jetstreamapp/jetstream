---
id: other-useful-features
title: Other Useful Features
sidebar_label: Other Useful Features
slug: /other-useful-features
---

import RecordLookupIcon from '../assets/icons/record_lookup.svg';

## Viewing, Editing, and Cloning records

Jetstream provides a few different ways for working with records.

### If you already have a record id

If you already have the record id and want to view, edit, or clone the record, click the <RecordLookupIcon className="icon inline" /> record lookup icon on the top toolbar to open the View Record Details popover.

:::tip

You can open the view record details popover by pressing `command+k` or `control+k`.

:::

You can enter in a 15 or 18 digit id to view the record. The most recent 10 record ids for the currently selected org are displayed in case you need to look at one of the records again.

<img src={require('./view-record-details.png').default} alt="View record details" />

### If you need to find the record

Use the query page to find the record you want to work with. From the query results table, click on the view, edit, or clone icon.

<img src={require('./view-record-from-query-results.png').default} alt="View record details from query results" />

### Working with the record

After taking any of the actions above, you will be presented with a modal that will show you the record and allow you to edit the record.

If you started out in view mode, you can switch over to edit mode by clicking the buttons at the bottom of the modal.

<img src={require('./view-record.png').default} alt="View record modal" />
