import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { action } from '@storybook/addon-actions';
import { array, boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import FileOrGoogleSelector from './FileOrGoogleSelector';
import FileSelector from './FileSelector';
import GoogleFileSelector from './GoogleFileSelector';
import GoogleFolderSelector from './GoogleFolderSelector';
import ImageSelector from './ImageSelector';

export default {
  component: FileSelector,
  title: 'FileSelector',
};

export const fileSelector = () => (
  <FileSelector
    id={text('id', 'input-file-selector')}
    label={text('label', 'Attachment')}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', false)}
    accept={array('accept', [INPUT_ACCEPT_FILETYPES.ZIP, INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]) as any[]}
    userHelpText={text('userHelpText', 'CSV, XLSX, or ZIP files are accepted ')}
    onReadFile={action('onReadFile')}
  ></FileSelector>
);

export const googleDrive = () => (
  <GoogleFileSelector
    apiConfig={{
      appId: '1046118608516',
      apiKey: 'AIzaSyBKlRmVgUxJ928co_CTT1Rx_RbmkKiibgU',
      clientId: '1046118608516-54c1gdvmaosuh84k2oamot7a0kql3p0i.apps.googleusercontent.com',
    }}
    className={text('className', undefined)}
    label={text('label', 'Choose from Google Drive')}
    buttonLabel={text('buttonLabel', undefined)}
    helpText={text('buttonLabel', 'Some extra text')}
    hideLabel={boolean('hideLabel', false)}
    onSelected={action('onSelected')}
    onReadFile={action('onReadFile')}
    onError={action('onError')}
  />
);

export const googleDriveSelectFolder = () => (
  <GoogleFolderSelector
    apiConfig={{
      appId: '1046118608516',
      apiKey: 'AIzaSyBKlRmVgUxJ928co_CTT1Rx_RbmkKiibgU',
      clientId: '1046118608516-54c1gdvmaosuh84k2oamot7a0kql3p0i.apps.googleusercontent.com',
    }}
    className={text('className', undefined)}
    label={text('label', 'Choose from Google Drive')}
    buttonLabel={text('buttonLabel', undefined)}
    helpText={text('buttonLabel', 'Some extra text')}
    hideLabel={boolean('hideLabel', false)}
    onSelected={action('onSelected')}
    isRequired={boolean('isRequired', true)}
    onError={action('onError')}
  />
);

export const fileInputAndGoogleDrive = () => (
  <FileOrGoogleSelector
    omitGoogle={boolean('omitGoogle', false)}
    fileSelectorProps={{
      id: text('fileId', 'file'),
      label: text('fileLabel', 'Choose a file'),
      className: text('fileClassName', undefined),
      userHelpText: text('fileHelpText', 'Choose a CSV or Excel file'),
      labelHelp: text('fileLabelHelp', 'Some other help text'),
      hideLabel: boolean('fileHideLabel', false),
      isRequired: boolean('fileIsRequired', true),
      onReadFile: action('fileOnReadFile'),
    }}
    googleSelectorProps={{
      apiConfig: {
        appId: '1046118608516',
        apiKey: 'AIzaSyBKlRmVgUxJ928co_CTT1Rx_RbmkKiibgU',
        clientId: '1046118608516-54c1gdvmaosuh84k2oamot7a0kql3p0i.apps.googleusercontent.com',
      },
      id: text('googleId', 'google'),
      label: text('googleLabel', 'Choose a file from Google Drive'),
      buttonLabel: text('googleButtonLabel', 'Google Sheet'),
      className: text('googleClassName', undefined),
      helpText: text('googleHelpText', 'Choose a Google Sheet'),
      labelHelp: text('googleLabelHelp', 'Some other help text'),
      hideLabel: boolean('googleHideLabel', false),
      isRequired: boolean('googleIsRequired', true),
      onReadFile: action('googleOnReadFile'),
    }}
  />
);

export const imageSelector = () => (
  <ImageSelector
    label={text('label', undefined)}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', false)}
    onReadImages={action('onReadFile')}
    showPreview={boolean('showPreview', true)}
    buttonLabel={text('buttonLabel', undefined)}
    errorMessage={text('errorMessage', undefined)}
    hasError={boolean('hasError', false)}
    labelHelp={text('labelHelp', undefined)}
    autoUploadImages={false}
  ></ImageSelector>
);
