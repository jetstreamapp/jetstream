import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { Card, FeedbackLink, Grid, Icon } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
import { useTitle } from 'react-use';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FeedbackFormProps {}

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = () => {
  useTitle(TITLES.FEEDBACK);
  const cardRef = useRef<HTMLElement>();

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
        <hr />
        <div>
          <p>Jetstream is an open source project and is paid for and supported by volunteers.</p>
          {process.env.NX_SHOW_DONATION && (
            <a
              href="https://github.com/sponsors/jetstreamapp"
              className="slds-button slds-button_brand slds-m-top_medium"
              target="_blank"
              rel="noreferrer"
            >
              <Icon type="custom" icon="heart" className="slds-button__icon slds-m-right_x-small" omitContainer />
              Become a sponsor or make a donation
            </a>
          )}
        </div>
      </Grid>
    </Card>
  );
};

export default FeedbackForm;
