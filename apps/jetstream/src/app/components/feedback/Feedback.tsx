import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import FeedbackForm from './FeedbackForm';

export const Feedback = () => {
  useTitle(TITLES.FEEDBACK);

  return (
    <div className="slds-container_medium slds-container_center">
      <FeedbackForm />
    </div>
  );
};

export default Feedback;
