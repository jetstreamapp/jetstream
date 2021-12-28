---
id: load-attachments
title: Load Files and Attachments
sidebar_label: Load Files and Attachments
slug: /load-attachments
---

You can load in files for objects that support file attachments.

:::tip

If you just want to update existing records for a supported object, you don't need to include a zip file with your data load.

:::

When you choose an object that supports file attachments, such as the `Attachment` object, you will have the ability to optionally include a zip file with your attachments.

<img src={require('./load-attachments-file-input.png').default} alt="Add zip file to data load" />

## File Structure

The names and paths of the the files inside your zip file need to be included on your data file and mapped to the field where Salesforce stores the content.

If your zip files has the following images:

- `image1.png`
- `my folder`
  - `image2.png`
  - `image3.png`
- `pdf`
  - `ABC-corp-service-order.pdf`

Then your data file needs to have the following rows, assuming you are loading to the `Attachment` object, otherwise the Body field might be different:

| Name       | Body                           |
| ---------- | ------------------------------ |
| image 1    | image1.png                     |
| image 2    | my folder/image2.png           |
| My image 3 | pdf/ABC-corp-service-order.pdf |

You can choose anything you want for the `Name`, this will be the name of the record in Salesforce.

:::info

- If you have extra files in your Zip file, they will be ignored.
- If your load file references a file that does not exist in the Zip file, this will result in an error.

:::

## Loading Data

On the final load screen, you will be limited to the options that you can change when you are loading a zip file.

Depending on the size of your zip file, preparing the data may take a minute or two to pre-process your data to send to Salesforce. This is all done in your browser and none of your data is logged or stored on the Jetstream server.

## Limitations

- Your zip file can be a maximum of `100MB`, if you need to load more attachments then you will need to split up your data and perform multiple data loads.
- The batch size will be auto-calculated to ensure that Salesforce request limits are not exceeded.
- You are required to use the batch api to perform the upload, which means that there may be more api requests required.

## Supported Objects

The following objects allow loading files:

- Attachment
- Document
- ContentVersion
