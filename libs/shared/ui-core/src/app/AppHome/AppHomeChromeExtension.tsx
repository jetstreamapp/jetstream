import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Badge, Icon } from '@jetstream/ui';
import { userProfileEntitlementState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useAmplitude } from '../../analytics';

const CURRENT_TIME = new Date().getTime();

export const AppHomeChromeExtension = () => {
  const { trackEvent } = useAmplitude();
  const hasExtensionAccess = useRecoilValue(userProfileEntitlementState('chromeExtension'));

  return (
    <div
      className="slds-box slds-box_x-small"
      css={css`
        background-color: white;
        grid-column: span 3;

        @media (max-width: 1024px) {
          grid-column: span 2;
        }

        @media (max-width: 768px) {
          grid-column: span 1;
        }
      `}
    >
      <article className="slds-tile slds-media">
        <div className="slds-media__figure">
          <Icon
            type="standard"
            icon="connected_apps"
            containerClassname="slds-icon_container"
            className={classNames('slds-icon slds-icon_small', `slds-icon-standard-employee-organization`)}
          />
        </div>
        <div className="slds-media__body">
          <h3
            className="slds-text-title_caps"
            css={css`
              line-height: 1.5rem;
              font-size: 0.85rem;
              font-weight: 600;
            `}
          >
            {APP_ROUTES.CHROME_EXTENSION.TITLE}
            {APP_ROUTES.CHROME_EXTENSION.NEW_UNTIL && APP_ROUTES.CHROME_EXTENSION.NEW_UNTIL >= CURRENT_TIME && (
              <Badge type="success" className="slds-m-left_xx-small">
                NEW
              </Badge>
            )}
          </h3>
          <p>
            <a
              href={APP_ROUTES.CHROME_EXTENSION.ROUTE}
              target="_blank"
              className="slds-text-heading_x-small"
              rel="noreferrer"
              onClick={() => trackEvent(ANALYTICS_KEYS.chrome_extension_link, { action: 'clicked', source: 'app_home' })}
            >
              Visit the Chrome Store to install the Extension
            </a>
          </p>
          <p>
            <a
              href={APP_ROUTES.FIREFOX_EXTENSION.ROUTE}
              target="_blank"
              className="slds-text-heading_x-small"
              rel="noreferrer"
              onClick={() => trackEvent(ANALYTICS_KEYS.firefox_extension_link, { action: 'clicked', source: 'app_home' })}
            >
              Visit the Firefox Store to install the Extension
            </a>
          </p>
          {!hasExtensionAccess && (
            <>
              <p>
                The Chrome extension <strong>requires a Pro</strong> subscription.{' '}
                <Link
                  to="/settings/billing"
                  onClick={() => trackEvent(ANALYTICS_KEYS.billing_page_accessed, { action: 'clicked', source: 'app_home' })}
                >
                  Subscribe to Jetstream on our billing page
                </Link>
              </p>
              <p className="slds-m-top_xx-small">
                Use your Favorite Jetstream features in any Salesforce Org with the The browser extensions!
              </p>
              <ul className="slds-list_dotted slds-m-bottom_small">
                <li>Access Jetstream on any Salesforce Org without having to connect it to your Jetstream account</li>
                <li>The browser works 100% in your browser without sending any Salesforce data to the Jetstream Server</li>
                <li>Quickly view all fields from a Salesforce record</li>
                <li>Access nearly every Jetstream feature, all without relying on a 3rd party server</li>
              </ul>
            </>
          )}

          <p>
            <a href={APP_ROUTES.CHROME_EXTENSION.DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
              Documentation
              <Icon
                type="utility"
                icon="help_doc_ext"
                className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                omitContainer
              />
            </a>
          </p>
        </div>
      </article>
    </div>
  );
};
