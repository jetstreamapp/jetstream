import { OverlayProvider } from '@react-aria/overlays';
import { render } from '@testing-library/react';
import { Fragment } from 'react';
import Modal from '../Modal';
// TODO:
describe(' Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <OverlayProvider>
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
      </OverlayProvider>
    );
    expect(baseElement).toBeTruthy();
  });
});
