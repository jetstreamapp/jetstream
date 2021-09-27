---
id: deploy
title: Deploy or Change Metadata
sidebar_label: Deploy or Change Metadata
slug: /deploy
---

import Refresh from '../assets/icons/Refresh.svg';

The **Deploy Metadata** feature provides the ability to work with metadata in your org and includes the following capabilities:

1. Deploy metadata from one org to another org
2. Add metadata to an outbound changeset
3. View the contents of any metadata
4. Compare metadata between two different orgs
5. Download a metadata package to your computer
6. Deploy a metadata package

:::tip

The Deploy Metadata tools provide a ton of cool benefits outside of deploying metadata from one org to another.

For example, here are some example use-cases:

1. Search across lots of metadata for a specific term or field.
2. Make changes to lots of metadata at once, for example adding help-text or descriptions to many fields.
3. Backing up metadata at a point in time to allow restoring metadata to a prior state.
4. Viewing a list of all the metadata that was recently modified and by whom was it modified.
   1. This is great for tracking changes when preparing for a deployment.

:::

## Metadata selection

For most actions, you will usually start by choosing one or more metadata types.

**Optionally, you can also configure additional options**:

1. Only show metadata from specific users
2. Only show metadata that was modified since a specific date range or between a certain time-period
3. Include managed packaged metadata

Click **Continue** to view all the metadata

<img src={require('./deploy-selection.png').default} alt="Deploy selection" />

## Working with metadata

Once the metadata is all loaded, you will be shown a table with a list of all the metadata.

To change the filters that were on the initial metadata page, click the buttons along the top.

Jetstream caches data in your browser to keep the experience fast, so if there was recent changes to metadata then Jetstream may be showing out-dated information. Click the **Not seeing recent metadata?** link to show you how old each type of metadata is, with the option to refresh some or all of the items.

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
  - This will not make any changes, but will go through a deployment option. After validation, the results will show in the Deployment Status area in Salesforce setup and can be quick deployed from Salesforce.
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

Prior to submitting the deployment, make sure to carefully review all the selected items and the source and target org.

:::

Choose the metadata items that you would like to deploy and click **Deploy to Different Org**.

Choose the destination org that you would like to deploy to, and configure the deployment options.

Once the deployment starts, you can view the progress in Salesforce under the **Deployment Status** option in Setup.

If unit tests were configured to run, the test results will be shown as well.

<img src={require('./deploy-results.png').default} alt="Deploy results" />

## Add metadata to an outbound changeset

:::caution

Because of the way Salesforce works, all metadata items added to a changeset will show as having been modified by your user and will have the last modified timestamp updated to the current date/time.

:::

You can use Jetstream to add metadata to your outbound changeset as long as the changeset is open and has not been uploaded to another org.

You can only upload metadata to an outbound changeset that has a unique name. **Make sure that the changeset name is not used on more than one changeset**.

Choose the metadata items that you would like to deploy and click **Add to Outbound Changeset**.

Enter in the name of the Changeset, this is case-sensitive and must be entered exactly the same as the name of the changeset and click **deploy** to add all of the selected items to the outbound changeset.

:::important

The changeset description will always be overridden when you add items to the changeset, so if you don't want the description to be removed, copy and paste the description.

:::

## Viewing and comparing metadata

Choose the metadata items that you would like to view or compare and click **View or Compare Selected Items**.

This will open a modal with all of the metadata that you can view without having to download anything.

To compare all the selected metadata components with another org, choose the org in the dropdown.

This will show a line-by-line diff of the content. You can click the swap <Refresh className="icon inline" /> icon to change which is on the left and which is on the right to make sure it is easy to understand the diff.

<img src={require('./view-or-compare-metadata.png').default} alt="View and compare metadata" />

## Downloading metadata

Choose the metadata items that you would like to download and click **Download Metadata**, which will open a dialog to save the metadata as a zip file.

Now that you have a metadata package downloaded, you can do the following:

1. Make changes to the files on your computer, then re-zip the files and upload them back into your org.
2. Deploy the metadata to a different org.
3. Save as a backup of the metadata as of right now, which you can deploy at a future date to restore.

If you are planning to make changes to the metadata on your computer,

:::tip

After unzipping, open the entire unzipped folder with [Visual Studio Code](https://code.visualstudio.com/). You can then search across all files at once and easily toggle between files without having to open each one individually.

:::

:::tip

You can click **Download Manifest** to get a file with a list of all the selected metadata items. Then you can use the XML manifest to download that exact set of metadata from any org at any point in the future.

:::

### Downloading metadata from package

Click the **Download Metadata Package** button to open the download modal, where you will be presented with two options:

1. Download from manifest
2. Download from outbound changeset or unmanaged package

#### Download from manifest

If you have a `Package.xml` manifest file, which you can obtain on the metadata selection page by clicking **Download Manifest**, you can use that to download that same set of metadata again.

:::tip

If you download a package as a zip file, there will be a file named `Package.xml` in the root of the unzipped folder. You can use this to re-download that metadata at any point in time.

:::

#### Download from outbound changeset or unmanaged package

Enter the name(s) of an outbound changeset or an unmanaged package that was built in the selected org to download all the metadata as a zip file.

## Uploading metadata

:::info

If you have zipped a metadata package by hand, it is usually best to make sure `Package.xml` is at the root of the folder. If you zipped the surrounding folder, then make sure to uncheck **Single Package** for the load to be processed successfully by Salesforce. Jetstream will warn you if the Single Package checkbox does not appear to match the structure of the zip file.

:::

If you have a metadata package zip file, you can deploy it to any org in the same way all other deployments work.

There are two additional options compared to a regular deployment:

1. Skip Recycle Bin on Delete
   1. You can delete changes using a [destructive package](https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm), and this setting will be ignored if you are not including a destructive package in your deployment.
2. Single Package
   1. Uncheck this if you are uploading more than one package or if your zip file has a surrounding sub-folder.

<img src={require('./upload-metadata.png').default} alt="Upload metadata configuration modal" />
