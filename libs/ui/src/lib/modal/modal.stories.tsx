import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';
import React, { Fragment } from 'react';
import Modal from './Modal';

export default {
  title: 'Modal',
};

const content = (
  <Fragment>
    <p>
      Sit nulla est ex deserunt exercitation anim occaecat. Nostrud ullamco deserunt aute id consequat veniam incididunt duis in sint irure
      nisi. Mollit officia cillum Lorem ullamco minim nostrud elit officia tempor esse quis. Cillum sunt ad dolore quis aute consequat ipsum
      magna exercitation reprehenderit magna. Tempor cupidatat consequat elit dolor adipisicing.
    </p>
    <p>
      Dolor eiusmod sunt ex incididunt cillum quis nostrud velit duis sit officia. Lorem aliqua enim laboris do dolor eiusmod officia.
      Mollit incididunt nisi consectetur esse laborum eiusmod pariatur proident. Eiusmod et adipisicing culpa deserunt nostrud ad veniam
      nulla aute est. Labore esse esse cupidatat amet velit id elit consequat minim ullamco mollit enim excepteur ea.
    </p>
  </Fragment>
);

export const modal = () => (
  <Modal
    header={text('header', 'This is the modal header')}
    tagline={text('tagline', undefined)}
    footer={
      <Fragment>
        <button className="slds-button slds-button_neutral">Cancel</button>
        <button className="slds-button slds-button_brand">Save</button>
      </Fragment>
    }
    directionalFooter={boolean('directionalFooter', false)}
    size={select(
      'size',
      {
        Small: 'sm',
        Medium: 'md',
        Large: 'lg',
        NotSpecified: undefined,
      },
      undefined
    )}
    containerClassName={text('containerClassName', '')}
    onClose={action('onclose')}
  >
    {content}
  </Modal>
);

export const modalWithoutHeaderOrFooter = () => (
  <Modal
    header={text('header', undefined)}
    tagline={text('tagline', undefined)}
    directionalFooter={boolean('directionalFooter', false)}
    size={select(
      'size',
      {
        Small: 'sm',
        Medium: 'md',
        Large: 'lg',
        NotSpecified: undefined,
      },
      undefined
    )}
    containerClassName={text('containerClassName', '')}
    onClose={action('onclose')}
  >
    {content}
  </Modal>
);

export const modalWizard = () => (
  <Modal
    header={text('header', 'This is the modal header')}
    tagline={text('tagline', undefined)}
    footer={
      <Fragment>
        <button className="slds-button slds-button_neutral">Go Back</button>
        <button className="slds-button slds-button_brand">Save and Continue</button>
      </Fragment>
    }
    directionalFooter={boolean('directionalFooter', true)}
    size={select(
      'size',
      {
        Small: 'sm',
        Medium: 'md',
        Large: 'lg',
        NotSpecified: undefined,
      },
      undefined
    )}
    containerClassName={text('containerClassName', '')}
    onClose={action('onclose')}
  >
    {content}
  </Modal>
);
