import React, { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FeedbackProps {}

export const Feedback: FunctionComponent<FeedbackProps> = () => {
  return (
    <div className="slds-align_absolute-center">
      <iframe
        title="Google Forms - feedback"
        src="https://docs.google.com/forms/d/e/1FAIpQLScroCh80FwgnlloEjZEmAQr7r-6D2Tb4TmOPDIXiu-fE8Bglw/viewform?embedded=true"
        width={640}
        height={1050}
        frameBorder={0}
        marginHeight={0}
        marginWidth={0}
      >
        Loading…
      </iframe>
    </div>
  );
};

export default Feedback;
