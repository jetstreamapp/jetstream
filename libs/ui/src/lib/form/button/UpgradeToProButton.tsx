import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Link } from 'react-router';
import Icon from '../../widgets/Icon';
import Tooltip from '../../widgets/Tooltip';

export interface UpgradeToProButtonProps {
  showOpenInNewTabIcon?: boolean;
  source: 'navbar' | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackEvent: (key: string, value?: Record<string, any>) => void;
}

export const UpgradeToProButton = ({ showOpenInNewTabIcon, source, trackEvent }: UpgradeToProButtonProps) => {
  return (
    <Tooltip
      openDelay={1000}
      content={
        <div className="slds-p-bottom_small">
          Upgrade to get access to the Browser Extensions, Google Drive integration, and Query History Sync
        </div>
      }
    >
      <Link
        to={APP_ROUTES.BILLING.ROUTE}
        css={css`
          /* teal-700 → cyan-800: white 13px text on the old teal-500 → cyan-600 gradient was 2.5:1 at the left edge */
          background-image: linear-gradient(to right, #0f766e, #155e75);
          border-color: transparent;
          text-wrap-mode: nowrap;
          /* Beat scoped-notification theme rules (e.g. slds-theme_info) that force links to a blue, underlined style */
          &,
          &:hover,
          &:focus,
          &:visited {
            color: #fff !important;
            text-decoration: none !important;
          }
          &:hover {
            background-image: linear-gradient(to right, #115e59, #164e63);
          }
        `}
        className="slds-button slds-button_brand"
        onClick={() => trackEvent(ANALYTICS_KEYS.billing_page_accessed, { action: 'clicked', source })}
      >
        {showOpenInNewTabIcon && (
          <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
        )}
        Upgrade
      </Link>
    </Tooltip>
  );
};
