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

The names and paths of the the files inside your zip file need to be included on your data file and mapped to the field where Salesforce stores the content.

## File Structure

If your zip files has the following images:

- `image1.png`
- `my folder`
  - `image2.png`
  - `image3.png`
- `pdf`
  - `ABC-corp-service-order.pdf`

Then your data file needs to have the following rows, assuming you are loading to `Attachment`, otherwise the Body field might be different:

| Name       | Body                           |
| ---------- | ------------------------------ |
| image 1    | image1.png                     |
| image 2    | my folder/image2.png           |
| My image 3 | pdf/ABC-corp-service-order.pdf |

You can choose anything you want for the `Name`, this will be the name of the record in Salesforce.

## Limitations

- Your zip file can be a maximum of `10MB`, if you need to load more attachments then you will need to perform multiple data loads
  - We plan to work around the Salesforce limitation in the future
- Your zip file can have a maximum of 1,000 files
- You are required to use the bulk api to perform the upload

## Supported Objects

The following objects allow downloading files:

- Attachment
- Document
- ContentVersion
