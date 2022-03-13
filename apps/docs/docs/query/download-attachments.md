---
id: download-attachments
title: Download Files and Attachments
description: Jetstream allows you easily to download files and attachments from your org across many records.
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
    query records,
    query attachments,
    download attachments,
    download files,
    query files,
    salesforce files,
    files and attachments,
    notes and attachments,
    salesforce documents,
  ]
sidebar_label: Download Files and Attachments
slug: /query/download-attachments
---

:::info

We never store any of your files or other data on the Jetstream server. The files are downloaded from Salesforce and combined into a Zip file directly in your browser.

:::

From the Query Results page, you can download one or more files from Salesforce by performing a query on a supported object and selecting at least one row to download. This will combine all the files into a zip file.

If you are viewing the query results of a supported object, then you will see a link to **Download Selected Attachments** above the records.

<img src={require('./download-attachments.png').default} alt="Download attachments" />

In order for Jetstream to be able to download the attachments, your query needs to include the Body, Filename, and Size fields.

The exact fields vary per object, but Jetstream will let you know if you are missing any and which fields to include.

<img src={require('./download-attachments-missing-fields.png').default} alt="Missing fields tooltip" />

## Supported Objects

The following objects allow downloading files:

- Attachment
- Document
- ContentVersion
