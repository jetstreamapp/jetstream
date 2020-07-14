import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React, { Fragment, useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';

export default {
  title: 'ConfirmationDialog',
  component: ConfirmationDialog,
};

const content = (
  <Fragment>
    <p>
      Are you sure you want to sit nulla? Sit nulla est ex deserunt exercitation anim occaecat. Nostrud ullamco deserunt aute id consequat
      veniam incididunt duis in sint irure nisi. Mollit officia cillum Lorem ullamco minim nostrud elit officia tempor esse quis. Cillum
      sunt ad dolore quis aute consequat ipsum magna exercitation reprehenderit magna. Tempor cupidatat consequat elit dolor adipisicing.
    </p>
  </Fragment>
);

export const confirmationDialog = () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Fragment>
      <button className="slds-button" onClick={() => setIsOpen(true)}>
        Show dialog
      </button>
      <ConfirmationDialog
        isOpen={isOpen}
        header={text('header', undefined)}
        tagline={text('tagline', undefined)}
        cancelText={text('cancelText', undefined)}
        confirmText={text('confirmText', undefined)}
        onCancel={() => {
          setIsOpen(false);
          action('onCancel')();
        }}
        onConfirm={() => {
          setIsOpen(false);
          action('onConfirm')();
        }}
      >
        {content}
      </ConfirmationDialog>
    </Fragment>
  );
};
