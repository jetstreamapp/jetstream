import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import CodeEditor from './CodeEditor';

export default {
  component: CodeEditor,
  title: 'CodeEditor',
};

export const base = () => (
  <CodeEditor
    value="SELECT Id FROM Account"
    lineNumbers={boolean('lineNumbers', false)}
    readOnly={boolean('readOnly', false)}
    size={{
      tabSize: 2,
      width: text('width', null),
      height: text('height', null),
    }}
    onChange={action('onChange')}
  />
);
