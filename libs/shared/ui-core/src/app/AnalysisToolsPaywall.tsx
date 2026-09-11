import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Icon, UpgradeToProButton, ViewDocsLink } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { useAmplitude } from '../analytics';

export interface AnalysisToolsPaywallProps {
  /** Feature name shown in the heading, e.g. "Field Usage Analysis". Defaults to "Analysis Tools". */
  featureLabel?: string;
  /** Docs URL for the specific tool the user landed on, so they can read what they would be buying. */
  docsPath?: string;
}

/**
 * In-page paywall shown when a user without the {@link analysisToolsAccessState} entitlement reaches an
 * analysis route. Nav items and home cards stay visible for discovery, so this is a normal destination
 * rather than a fallback — it has to sell the feature, not just block it. Processing is browser-only, so
 * there is no server-side enforcement.
 */
export const AnalysisToolsPaywall: FunctionComponent<AnalysisToolsPaywallProps> = ({
  featureLabel = 'Analysis Tools',
  docsPath = APP_ROUTES.PERMISSION_ANALYSIS.DOCS,
}) => {
  const { trackEvent } = useAmplitude();
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
        <p className="slds-text-body_regular slds-text-color_weak slds-m-bottom_small">
          Permission Analysis scans the profiles and permission sets you choose for over-access, dangerous system permissions, and field
          security that is not backed by object access. Field Usage Analysis measures how much of your data actually populates each field so
          you can find the ones nobody uses. Every result can be exported to Excel, CSV, or JSON.
        </p>
        <div className="slds-align_absolute-center slds-m-bottom_medium">
          <ViewDocsLink path={docsPath} textReset />
        </div>
        <div className="slds-align_absolute-center">
          <UpgradeToProButton source="analysis-tools" trackEvent={trackEvent} />
        </div>
      </div>
    </div>
  );
};

export default AnalysisToolsPaywall;
