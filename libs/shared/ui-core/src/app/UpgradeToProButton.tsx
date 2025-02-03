import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Tooltip } from '@jetstream/ui';
import { Link } from 'react-router-dom';

export const UpgradeToProButton = () => {
  return (
    <Tooltip
      delay={[1000, null]}
      content={
        <div className="slds-p-bottom_small">Upgrade to get access to the Chrome Extension, Google Drive integration, and Record Sync</div>
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
      >
        Upgrade to Pro
      </Link>
    </Tooltip>
  );
};
