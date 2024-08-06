import { FeedbackLink, Grid } from '@jetstream/ui';

export const GlobalExtensionError = ({ message }: { message: string }) => {
  return (
    <div className="slds-card slds-box">
      <p>There was a problem connecting with Salesforce. Make sure you are logged in to Salesforce and try again.</p>
      {message && <p className="slds-m-top_small slds-text-color_error">{message}</p>}
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
