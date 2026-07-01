import { css } from '@emotion/react';
import { Icon, UpgradeToProButton } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { useAmplitude } from '../analytics';

export interface AnalysisToolsPaywallProps {
  /** Feature name shown in the heading, e.g. "Field Usage Analysis". Defaults to "Analysis Tools". */
  featureLabel?: string;
}

/**
 * In-page paywall shown when a user without the {@link analysisToolsAccessState} entitlement reaches an
 * analysis route directly. Discovery is also gated (nav + home cards are hidden), so this is the fallback
 * for bookmarked/shared URLs. Processing is browser-only, so there is no server-side enforcement.
 */
export const AnalysisToolsPaywall: FunctionComponent<AnalysisToolsPaywallProps> = ({ featureLabel = 'Analysis Tools' }) => {
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
        <p className="slds-text-body_regular slds-text-color_weak slds-m-bottom_medium">
          Field Usage and Permission Analysis are available on a paid Jetstream plan. Upgrade to scan field population
          across your objects, find unused fields, and audit profile and permission-set coverage.
        </p>
        <div className="slds-align_absolute-center">
          <UpgradeToProButton source="analysis-tools" trackEvent={trackEvent} />
        </div>
      </div>
    </div>
  );
};

export default AnalysisToolsPaywall;
