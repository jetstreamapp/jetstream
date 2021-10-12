import { OverlayProvider } from '@react-aria/overlays';
import { Meta, Story } from '@storybook/react';
import React, { Fragment } from 'react';
import ModalComponent, { ModalProps } from './Modal';

export default {
  title: 'overlays/modal',
  component: ModalComponent,
  argTypes: {
    type: {
      options: ['info', 'success', 'warning', 'error', 'offline'],
      defaultValue: 'info',
    },
    onClose: { action: 'onClose' },
  },
  args: {
    hide: false,
    header: 'My Fancy Modal',
    tagline: 'My Fancy Tagline',
    closeDisabled: false,
    closeOnEsc: true,
    closeOnBackdropClick: true,
    skipAutoFocus: false,
    children: (
      <Fragment>
        <p>
          Sit nulla est ex deserunt exercitation anim occaecat. Nostrud ullamco deserunt aute id consequat veniam incididunt duis in sint
          irure nisi. Mollit officia cillum Lorem ullamco minim nostrud elit officia tempor esse quis. Cillum sunt ad dolore quis aute
          consequat ipsum magna exercitation reprehenderit magna. Tempor cupidatat consequat elit dolor adipisicing.
        </p>
        <p>
          Dolor eiusmod sunt ex incididunt cillum quis nostrud velit duis sit officia. Lorem aliqua enim laboris do dolor eiusmod officia.
          Mollit incididunt nisi consectetur esse laborum eiusmod pariatur proident. Eiusmod et adipisicing culpa deserunt nostrud ad veniam
          nulla aute est. Labore esse esse cupidatat amet velit id elit consequat minim ullamco mollit enim excepteur ea.
        </p>
      </Fragment>
    ),
    footer: (
      <Fragment>
        <button className="slds-button slds-button_neutral">Cancel</button>
        <button className="slds-button slds-button_brand">Save</button>
      </Fragment>
    ),
  },
} as Meta;

const Template: Story<ModalProps> = ({ children, ...args }) => (
  <OverlayProvider>
    <ModalComponent {...args}>{children}</ModalComponent>
  </OverlayProvider>
);

export const Modal = Template.bind({});
