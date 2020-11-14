import { action } from '@storybook/addon-actions';
import { array, boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import FileSelector from './FileSelector';

export default {
  component: FileSelector,
  title: 'FileSelector',
};

export const base = () => (
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
