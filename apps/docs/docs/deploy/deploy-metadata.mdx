---
id: deploy-metadata
title: Deploy or Compare Metadata
description: Working with Salesforce metadata has never been easier. With Jetstream, you can Download, upload, deploy to another org, add metadata to a changeset, or compare metadata between orgs.
keywords: [
    salesforce,
    salesforce admin,
    salesforce developer,
    salesforce automation,
    salesforce workbench
    metadata,
    package.xml,
    package manifest,
    compare metadata,
    download metadata,
    changeset,
    deploy metadata,
    delete metadata,
  ]
sidebar_label: Deploy or Compare Metadata
slug: /deploy-metadata
---

import Refresh from '../assets/icons/Refresh.svg';

The **Deploy Metadata** feature provides the ability to work with metadata in your org and includes the following capabilities:

1. Deploy metadata from **one org to another org**
2. Add metadata to an **outbound changeset**
3. **View** the contents of metadata
4. **Compare** metadata between two orgs
5. **Delete** metadata from an org
6. **Download** a metadata package
7. **Deploy** a metadata package

:::tip

The Deploy Metadata tools provide many useful features in addition to deploying metadata from one org to another.

For example, here are some example use-cases you can solve by downloading metadata and working with it locally, then re-deploying it:

1. Search across lots of metadata at once.
2. Make changes to lots of metadata at once, for example adding help-text or descriptions to many fields.
3. Backing up metadata at a point in time to allow restoring metadata to a prior state.
4. Viewing a list of all the metadata that was recently modified and by whom was it modified.
   1. This is great for tracking changes when preparing for a deployment.

:::

## Metadata selection

For most actions, you will start by choosing one or more metadata types.

**Optionally, you can also configure additional options**:

1. Only show metadata from specific users
2. Only show metadata that was modified since a specific date or between a certain date range
3. Include managed packaged metadata

Click **Continue** to view all the metadata

<img src={require('./deploy-selection.png').default} alt="Deploy selection" />

## Working with metadata

Once the metadata is loaded, you will be shown a table with a list of all the metadata.

To change the filters that were on the initial metadata page, click the buttons above the table.

If you want to export the list of metadata from the table, click the dropdown menu at the top right section of the page to open the menu with export options.

<img src={require('./deploy-overflow-menu.png').default} alt="Deploy overflow menu" />

Jetstream caches data in your browser to keep the experience fast and recent metadata changes may not show up in Jetstream. Click the **Not seeing recent metadata?** link to show you how old each type of metadata is, with the option to refresh some or all of the items.

:::info

When doing a deployment, Jetstream will never use cached data. Even if the table shows outdated last modified by information, the current state of the metadata will always be used when performing any action.

:::

<div className="container">
  <div className="row">
    <div className="col col--8">
      <img src={require('./working-with-metadata.png').default} alt="Metadata table screenshot" />
    </div>
    <div className="col col--4">
      <img src={require('./working-with-metadata-refresh.png').default} alt="Refreshing cached metadata" />
    </div>
  </div>
</div>

## Deployment Options

Many of the deployment features share a set of deployment options, as described below.

- **Validate Only**
  - This performs a dry-run of the validation without making any changes to the org. After validation, the results will show in the Deployment Status area in Salesforce setup and can be quick deployed.
- **Ignore Warnings**
  - Allow deployment to succeed even if there are warnings.
- **Rollback on Error**
  - If false, allow the deployment to partially succeed. _(This option is ignored for production orgs)_
- **Unit tests to run**
  - Default
    - **Production orgs**: Run all non-managed tests
    - **Other orgs**: Do not run any tests
  - Run specified tests
    - Provide a list of unit tests to run
  - Do not run any tests
  - Run non-managed tests
  - Run all tests in org

## Deploy metadata from one org to another

:::tip

Prior to submitting the deployment, carefully review all the selected items and the source and target org.

:::

Choose the metadata items that you would like to deploy and click **Deploy to Different Org**.

Choose the destination org that you would like to deploy to, and configure the deployment options.

Once the deployment starts, you can view the progress in Salesforce under the **Deployment Status** option in Setup. You can also attempt to abort the deployment on the Deployment Status page in Salesforce, but this is not always possible.

If unit tests were configured to run, the test results will be shown as well.

<img src={require('./deploy-results.png').default} alt="Deploy results" />

## Add metadata to an outbound changeset

:::caution

Because of the way Salesforce works, all metadata items added to a changeset will show as having been modified by your user and will have the last modified timestamp updated to the current date/time.

:::

You can use Jetstream to add metadata to your outbound changeset as long as the changeset is open and has not been uploaded to another org.

You can only upload metadata to an outbound changeset if the Changeset name is unique. **Make sure that the changeset name is not used on more than one changeset**.

Choose the metadata items that you would like to deploy and click **Add to Outbound Changeset**.

Provide the name of the Changeset, this is case-sensitive and must be entered exactly the same as the name of the changeset. Click **deploy** to add all of the selected items to the outbound changeset.

:::important

The changeset description will always be overridden when you add items to the changeset. If you don't want the description to be removed, copy and paste the description from Salesforce before submitting the deployment.

:::

## Deployment history

After you deploy metadata, your deployment results will be saved. Access your history by clicking on the History button.

Your history will show a summary of each deployment and you can view the detailed results, or download the metadata package which can easily be re-deployed again.

:::note

All history data is stored in your browser, not on the Jetstream server.

:::

<img src={require('./deploy-history-table.png').default} alt="Deploy history table" />

## Viewing and comparing metadata

Choose the metadata items that you would like to view or compare and click **View or Compare Selected Items**.

This will open a modal with all of the metadata that you can view without having to download anything.

To compare all the selected metadata components with another org, choose the org in the dropdown.

This will show a line-by-line diff of the content. You can click the swap <Refresh className="icon inline" /> icon to change which is on the left and which is on the right.

<img src={require('./view-or-compare-metadata.png').default} alt="View and compare metadata" />

## Deleting metadata

:::caution

After you delete metadata from your org, you may not be able to recover it. You should download the metadata to your computer before deleting to use as a back-up in case you need to re-deploy it to your org.

:::

To delete metadata from one of your orgs, select the metadata components you would like to delete and then open the dropdown menu at the top right part of the page, and choose **Delete selected metadata**.

<img src={require('./deploy-overflow-menu.png').default} alt="Deploy overflow menu" />

Choose your deployment options just like any other deployment and continue to deploy or validate your package.

- If you choose **Validate Only**, then nothing will be changed in your org, but you will be able to find out if deleting the metadata will be successful.
- If you choose **Skip Recycle Bin on Delete**, then the metadata will not be recoverable.
  - Not all types of metadata can be recovered - some items, like Custom Fields, can be restored directly in Salesforce.
- If you are deleting metadata from production and the items you are deleting require code coverage, you may need to run all non-managed tests for the deployment to be successful.

In order to delete metadata, there cannot be any references to the metadata elsewhere in Salesforce. If there are, then Salesforce will return an error and metadata in your org will not be removed.

## Downloading metadata

Choose the metadata items that you would like to download and click **Download Metadata**, which will open a dialog to save the metadata as a zip file.

Now that you have a metadata package downloaded, you can do the following:

1. Make changes to the files on your computer, then re-zip the files and upload them back into your org.
2. Deploy the metadata to a different org.
3. Save a backup of the metadata as of right now, which you can deploy at a future date to restore.

:::tip

After unzipping, open the entire unzipped folder with [Visual Studio Code](https://code.visualstudio.com/). You can then search across all files at once and easily toggle between files without having to open each one individually.

:::

:::tip

You can open the menu dropdown and choose **Download package.xml manifest** to get a file with a list of all the selected metadata items. Then you can use this manifest to download that exact same set of metadata from any org in the future.

:::

### Downloading metadata from package

Click the **Download Metadata Package** button to open the download modal, where you will be presented with two options:

1. Download from manifest
2. Download from outbound changeset or unmanaged package

#### Download from manifest

If you have a `Package.xml` manifest file, which you can obtain on the metadata selection page by clicking **Download Manifest**, you can use that to download that same set of metadata again.

:::tip

If you download a package as a zip file, there will be a manifest file named `Package.xml` in the root of the unzipped folder. You can use this to re-download that same set of metadata at any point in time.

:::

#### Download from outbound changeset or unmanaged package

Enter the name(s) of an outbound changeset or an unmanaged package that was built in the selected org to download all the metadata as a zip file.

## Uploading metadata

:::info

If you have zipped a metadata package by hand, it is usually best to make sure `Package.xml` is at the root of the folder. If you zipped the surrounding folder, then make sure to uncheck **Single Package**. Jetstream will warn you if the Single Package checkbox does not appear to match the structure of the zip file.

:::

If you have a metadata package zip file, you can deploy it to any org in the same way all other deployments work.

There are two additional options compared to a regular deployment:

1. Skip Recycle Bin on Delete
   1. You can delete metadata using a [destructive package](https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm). This setting will be ignored if you are not including destructive changes in your deployment.
2. Single Package
   1. Uncheck this if you are uploading more than one package or if your zip file has a surrounding sub-folder.

<img src={require('./upload-metadata.png').default} alt="Upload metadata configuration modal" />
