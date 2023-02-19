import { TITLES } from '@jetstream/shared/constants';
import { UserProfileUi } from '@jetstream/types';
import { FunctionComponent } from 'react';
import { useTitle } from 'react-use';
import FeedbackForm from './FeedbackForm';

export interface FeedbackProps {
  userProfile: UserProfileUi;
}

export const Feedback: FunctionComponent<FeedbackProps> = ({ userProfile }) => {
  useTitle(TITLES.FEEDBACK);

  return (
    <div className="slds-container_medium slds-container_center">
      <FeedbackForm />
    </div>
  );
};

export default Feedback;
