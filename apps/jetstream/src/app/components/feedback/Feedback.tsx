import { UserProfileUi } from '@jetstream/types';
import React, { FunctionComponent } from 'react';
import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from 'react-use';

const FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeCJWLz8H2KwaV5YAbTkeiInvxE2Or-RUUxNW7UCaYdWgUIFg/viewform';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FeedbackProps {
  userProfile: UserProfileUi;
}

export const Feedback: FunctionComponent<FeedbackProps> = ({ userProfile }) => {
  useTitle(TITLES.FEEDBACK);
  return (
    <div className="slds-align_absolute-center">
      <iframe
        title="Google Forms - feedback"
        src={`${FORM_BASE_URL}?usp=sf_link&embedded=true&usp=pp_url&entry.571803321=${userProfile?.email || ''}`}
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
