import { css } from '@emotion/react';
import { Icon, UpgradeToProButton, ViewDocsLink } from '@jetstream/ui';
import { FunctionComponent, ReactNode } from 'react';

const ANALYSIS_TOOLS_DESCRIPTION =
  'Permission Analysis scans the profiles and permission sets you choose for over-access, dangerous system permissions, and field ' +
  'access the same profile or permission set never grants object access for, and every result grid downloads to Excel, CSV, or JSON. ' +
  'Field Usage Analysis measures how much of your data actually populates each field so you can find the ones nobody uses.';

export interface ProFeaturePaywallProps {
  /** Feature name shown in the heading, e.g. "Field Usage Analysis" */
  featureLabel: string;
  /** Docs URL for the specific tool the user landed on, so they can read what they would be buying. */
  docsPath?: string;
  /** What the feature does. Defaults to the description of the analysis tools. */
  description?: ReactNode;
}

/**
 * In-page paywall shown when a user without access reaches a paid tool's route. Nav items and home cards stay
 * visible for discovery, so this is a normal destination rather than a fallback — it has to sell the feature,
 * not just block it. These tools run in the browser, so there is no server-side enforcement.
 */
export const ProFeaturePaywall: FunctionComponent<ProFeaturePaywallProps> = ({
  featureLabel,
  docsPath,
  description = ANALYSIS_TOOLS_DESCRIPTION,
}) => {
  return (
    <div
      className="slds-p-around_large slds-align_absolute-center"
      css={css`
        min-height: 60vh;
      `}
    >
      <div
        className="slds-box slds-theme_default slds-text-align_center"
        css={css`
          max-width: 32rem;
        `}
      >
        <Icon
          type="utility"
          icon="billing"
          className="slds-icon slds-icon-text-default slds-icon_large slds-m-bottom_small"
          containerClassname="slds-icon_container"
        />
        <h2 className="slds-text-heading_medium slds-m-bottom_x-small">{featureLabel} is a paid feature</h2>
        <p className="slds-text-body_regular slds-text-color_weak slds-m-bottom_small">{description}</p>
        {docsPath && (
          <div className="slds-align_absolute-center slds-m-bottom_medium">
            <ViewDocsLink path={docsPath} textReset />
          </div>
        )}
        <div className="slds-align_absolute-center">
          <UpgradeToProButton />
        </div>
      </div>
    </div>
  );
};

export default ProFeaturePaywall;
