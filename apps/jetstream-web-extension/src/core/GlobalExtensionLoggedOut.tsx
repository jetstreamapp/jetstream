import { FeedbackLink, Grid } from '@jetstream/ui';
import { environment } from '../environments/environment';

export const GlobalExtensionLoggedOut = () => {
  return (
    <div className="slds-card slds-box">
      <p>This page is only accessible when you are logged in to the browser extension. Login to continue.</p>
      <a
        href={`${environment.serverUrl}/web-extension/auth`}
        target="_blank"
        className="slds-button slds-button_brand slds-m-top_small"
        rel="noreferrer"
      >
        Sign In
      </a>
      <hr className="slds-m-vertical_medium" />
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
    </div>
  );
};
