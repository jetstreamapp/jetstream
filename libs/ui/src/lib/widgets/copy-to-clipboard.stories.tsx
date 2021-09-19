import { Meta, Story } from '@storybook/react';
import React from 'react';
import CopyToClipboardComponent, { CopyToClipboardProps } from './CopyToClipboard';
import { iconObjMapping } from './icon-story.utils';

export default {
  title: 'widgets/copyToClipboard',
  component: CopyToClipboardComponent,
  argTypes: {
    size: {
      options: ['none', 'x-small', 'small', 'large'],
      mapping: {
        none: undefined,
      },
    },
    containerSize: {
      options: ['none', 'xxx-small', 'x-small', 'small'],
      mapping: {
        none: undefined,
      },
    },
    icon: {
      ...iconObjMapping,
    },
  },
  args: {
    className: 'slds-m-left--xx-small',
    icon: 'utility:copy_to_clipboard',
    content: 'content to copy',
  },
} as Meta;

const Template: Story<CopyToClipboardProps> = ({ children, ...args }) => (
  <CopyToClipboardComponent {...args}>{children}</CopyToClipboardComponent>
);

export const CopyToClipboard = Template.bind({});
