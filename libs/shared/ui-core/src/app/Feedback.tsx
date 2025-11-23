import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { Card, FeedbackLink, Grid } from '@jetstream/ui';
import { useRef } from 'react';

export const Feedback = () => {
  useTitle(TITLES.FEEDBACK);
  const cardRef = useRef<HTMLElement>(null);

  return (
    <div className="slds-container_medium slds-container_center">
      <Card
        ref={cardRef}
        className="slds-grow slds-is-relative"
        title="Get support"
        icon={{ type: 'standard', icon: 'feedback', description: 'submit feedback' }}
        css={css`
          max-width: 800px;
        `}
      >
        <Grid vertical>
          <div>
            <ol className="slds-list_ordered">
              <li>
                Bug reports and feature requests - <FeedbackLink type="GH_ISSUE" />
              </li>
              <li className="slds-m-top_x-small">
                <FeedbackLink type="GH_DISCUSSION" />
              </li>
              <li className="slds-m-top_x-small">
                Ask a question in the <strong>#vendors-jetstream</strong> Discord channel <FeedbackLink type="DISCORD" />
              </li>
              <li className="slds-m-top_x-small">
                You can always email us at <FeedbackLink type="EMAIL" />
              </li>
            </ol>
          </div>
        </Grid>
      </Card>
    </div>
  );
};

export default Feedback;
