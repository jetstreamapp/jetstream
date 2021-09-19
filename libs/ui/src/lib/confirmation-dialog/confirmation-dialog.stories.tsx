import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React, { Fragment, useState } from 'react';
import ConfirmationDialog, { ConfirmationDialogProps } from './ConfirmationDialog';
import { Story, Meta } from '@storybook/react';

export default {
  title: 'modals/ConfirmationDialog',
  component: ConfirmationDialog,
  argTypes: {
    isOpen: {
      control: false,
    },
    onCancel: {
      control: false,
    },
    onConfirm: {
      control: false,
    },
  },
  args: {},
} as Meta;

const Template: Story<ConfirmationDialogProps> = (args) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button className="slds-button slds-button_brand" onClick={() => setIsOpen(true)}>
        Show dialog
      </button>
      <ConfirmationDialog isOpen={isOpen} onCancel={() => setIsOpen(false)} onConfirm={() => setIsOpen(false)} {...args}>
        <p className="slds-p-around_medium">
          Are you sure you want to sit nulla? Sit nulla est ex deserunt exercitation anim occaecat. Nostrud ullamco deserunt aute id
          consequat veniam incididunt duis in sint irure nisi. Mollit officia cillum Lorem ullamco minim nostrud elit officia tempor esse
          quis. Cillum sunt ad dolore quis aute consequat ipsum magna exercitation reprehenderit magna. Tempor cupidatat consequat elit
          dolor adipisicing.
        </p>
      </ConfirmationDialog>
    </div>
  );
};

export const StandardDialog = Template.bind({});
