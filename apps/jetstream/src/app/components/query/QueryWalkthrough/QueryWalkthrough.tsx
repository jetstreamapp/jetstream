import { Grid, Modal } from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useState } from 'react';
import QueryWalkthroughStep1 from './QueryWalkthroughStep1';
import QueryWalkthroughStep2 from './QueryWalkthroughStep2';

export interface QueryWalkthroughProps {
  onClose: () => void;
}

export const QueryWalkthrough: FunctionComponent<QueryWalkthroughProps> = React.memo(({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);

  function handlePrevStep() {
    setCurrentStep(Math.max(currentStep - 1, 0));
  }

  function handleNextStep() {
    if (currentStep === 2) {
      onClose();
    } else {
      setCurrentStep(Math.min(currentStep + 1, 2));
    }
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      <Modal
        closeOnBackdropClick={false}
        closeOnEsc={false}
        footer={
          <Grid align="end">
            <div>
              <button className="slds-button slds-button_neutral" onClick={handlePrevStep} disabled={currentStep === 1}>
                Previous
              </button>
              <button className="slds-button slds-button_brand" onClick={handleNextStep}>
                {currentStep === 2 ? 'Close' : 'Next'}
              </button>
            </div>
          </Grid>
        }
        onClose={() => onClose()}
      >
        {currentStep === 1 && <QueryWalkthroughStep1 />}
        {currentStep === 2 && <QueryWalkthroughStep2 />}
      </Modal>
    </Fragment>
  );
});

export default QueryWalkthrough;
