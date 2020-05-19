import React, { Fragment } from 'react';
import { render } from '@testing-library/react';

import Modal from './Modal';
// TODO:
describe(' Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Modal
        header="This is the modal header"
        footer={
          <Fragment>
            <button className="slds-button slds-button_neutral">Cancel</button>
            <button className="slds-button slds-button_brand">Save</button>
          </Fragment>
        }
        directionalFooter={false}
        onClose={() => {}}
      >
        Test Content
      </Modal>
    );
    expect(baseElement).toBeTruthy();
  });
});
