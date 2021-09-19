import { css } from '@emotion/react';
import { Card, Grid, GridCol, Icon } from '@jetstream/ui';
import welcomeBackgroundImage from '@salesforce-ux/design-system/assets/images/welcome-mat/bg-info@2x.png';
import { FunctionComponent } from 'react';
import AddOrgImage from './images/add-org.png';
import OrgInfoImage from './images/org-info.png';
import SelectOrgImage from './images/select-org.png';

export const OrgWelcomeInstructions: FunctionComponent = () => {
  return (
    <Grid align="center" className="slds-m-top_small">
      <GridCol size={12} sizeLarge={8}>
        <div className="slds-welcome-mat slds-welcome-mat_splash">
          <div
            className="slds-welcome-mat__info slds-size_1-of-1"
            css={css`
              background-image: url(${welcomeBackgroundImage});
            `}
          >
            <div className="slds-welcome-mat__info-content">
              <h2 className="slds-welcome-mat__info-title" id="welcome-mat-101-label">
                Welcome to Jetstream.
              </h2>
              <div className="slds-welcome-mat__info-description slds-text-longform">
                <p>Jetstream provides everything you need to get your work done faster.</p>
                <p>Follow the steps below to get started.</p>
              </div>
              <div className="slds-welcome-mat__info-actions slds-text-align_left">
                <Card>
                  To start, add a Salesforce org using the link at the top of the page.
                  <Grid align="center" className="slds-m-around_small">
                    <img src={AddOrgImage} alt="add org" />
                  </Grid>
                </Card>
                <Card>
                  You can add as many Salesforce orgs as you'd like. To switch between them, use the dropdown.
                  <Grid align="center" className="slds-m-around_small">
                    <img src={SelectOrgImage} alt="select org" />
                  </Grid>
                </Card>
                <Card>
                  Click the <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small" /> next to the
                  org to see information, navigate to the org, or remove it.
                  <Grid align="center" className="slds-m-around_small">
                    <img src={OrgInfoImage} alt="get org info" />
                  </Grid>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </GridCol>
    </Grid>
  );
};

export default OrgWelcomeInstructions;
