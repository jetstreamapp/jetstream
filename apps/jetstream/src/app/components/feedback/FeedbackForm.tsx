import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { Card, FeedbackLink, Grid, Icon } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FeedbackFormProps {}

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = () => {
  useTitle(TITLES.FEEDBACK);
  const cardRef = useRef<HTMLElement>(null);

  return (
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
        <hr className="slds-m-vertical_medium" />
        <div>
          <h3 className="slds-text-heading_small slds-m-bottom_small">Support the Jetstream project</h3>
          <p>Jetstream is source-available project and is paid for and supported by the community.</p>
          <a
            href="https://github.com/sponsors/jetstreamapp"
            className="slds-button slds-button_brand slds-m-top_medium"
            target="_blank"
            rel="noreferrer"
          >
            <Icon type="custom" icon="heart" className="slds-button__icon slds-m-right_x-small" omitContainer />
            Become a sponsor
          </a>
        </div>
      </Grid>
    </Card>
  );
};

export default FeedbackForm;
