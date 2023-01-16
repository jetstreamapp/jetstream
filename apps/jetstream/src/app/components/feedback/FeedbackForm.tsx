import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { Card, Grid } from '@jetstream/ui';
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
              Bug reports and feature requests -{' '}
              <a href="https://github.com/jetstreamapp/jetstream/issues" target="_blank" rel="noreferrer">
                Create a Github Issue
              </a>
            </li>
            <li className="slds-m-top_x-small">
              <a href="https://github.com/jetstreamapp/jetstream/discussions" target="_blank" rel="noreferrer">
                Start a Github Discussion
              </a>
            </li>
            <li className="slds-m-top_x-small">
              Ask a question in the <strong>#vendors-jetstream</strong> Discord channel{' '}
              <a href="https://discord.gg/sfxd" target="_blank" rel="noreferrer">
                SFXD Discord Community
              </a>
            </li>
          </ol>
        </div>
        <p className="slds-m-bottom_small slds-m-top_large">
          You can always email us at{' '}
          <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
            support@getjetstream.app
          </a>
          .
        </p>
      </Grid>
    </Card>
  );
};

export default FeedbackForm;
