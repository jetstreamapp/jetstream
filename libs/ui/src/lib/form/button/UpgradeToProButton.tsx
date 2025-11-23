import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Link } from 'react-router-dom';
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
          background-image: linear-gradient(to right, #14b8a6, #0891b2);
          color: rgba(255, 255, 255);
          border-color: transparent;
          text-wrap-mode: nowrap;
          :hover {
            background-image: linear-gradient(to right, #0d9488, #0e7490);
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
