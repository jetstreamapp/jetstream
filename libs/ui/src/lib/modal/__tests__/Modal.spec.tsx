import { axeScan } from '@jetstream/test-utils';
import { render } from '@testing-library/react';
import { Fragment } from 'react';
import Modal from '../Modal';

function renderModal() {
  return render(
    <Modal
      header="This is the modal header"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral">Cancel</button>
          <button className="slds-button slds-button_brand">Save</button>
        </Fragment>
      }
      directionalFooter={false}
      onClose={() => {
        // do nothing
      }}
    >
      Test Content
    </Modal>,
  );
}

describe('Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = renderModal();
    expect(baseElement).toBeTruthy();
  });

  it('should have no axe violations', async () => {
    const { baseElement } = renderModal();
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
