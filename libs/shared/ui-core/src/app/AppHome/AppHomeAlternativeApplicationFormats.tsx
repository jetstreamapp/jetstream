import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Badge, Icon } from '@jetstream/ui';
import { userProfileEntitlementState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { Link } from 'react-router-dom';
import { useAmplitude } from '../../analytics';

const CURRENT_TIME = new Date().getTime();
const IS_NEW =
  (APP_ROUTES.BROWSER_EXTENSION.NEW_UNTIL && APP_ROUTES.BROWSER_EXTENSION.NEW_UNTIL >= CURRENT_TIME) ||
  (APP_ROUTES.DESKTOP_APPLICATION.NEW_UNTIL && APP_ROUTES.DESKTOP_APPLICATION.NEW_UNTIL >= CURRENT_TIME);

export const AppHomeAlternativeApplicationFormats = () => {
  const { trackEvent } = useAmplitude();
  const hasExtensionAccess = useAtomValue(userProfileEntitlementState('chromeExtension'));
  const hasDesktopAccess = useAtomValue(userProfileEntitlementState('desktop'));

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
            Other Form-Factors
            {IS_NEW && (
              <Badge type="success" className="slds-m-left_xx-small">
                NEW
              </Badge>
            )}
          </h3>
          {(!hasExtensionAccess || !hasDesktopAccess) && (
            <p className="slds-m-bottom_x-small">
              The desktop application and browser extension <strong>require a Pro</strong> subscription.{' '}
              <Link
                to="/settings/billing"
                onClick={() => trackEvent(ANALYTICS_KEYS.billing_page_accessed, { action: 'clicked', source: 'app_home' })}
              >
                Subscribe to Jetstream on our billing page
              </Link>
            </p>
          )}
          <h4 className="slds-text-title_caps">Desktop Application</h4>
          <a
            href={APP_ROUTES.DESKTOP_APPLICATION.ROUTE}
            target="_blank"
            className="slds-text-heading_x-small"
            rel="noreferrer"
            onClick={() => trackEvent(ANALYTICS_KEYS.desktop_app_download_link, { action: 'clicked', source: 'app_home' })}
          >
            Download the Desktop Application
          </a>
          {!hasDesktopAccess && (
            <p className="slds-m-top_xx-small">
              When using the desktop application, none of your Salesforce data is sent to the Jetstream server.
            </p>
          )}
          <p>
            <a href={APP_ROUTES.DESKTOP_APPLICATION.DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
              Documentation
              <Icon
                type="utility"
                icon="help_doc_ext"
                className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                omitContainer
              />
            </a>
          </p>
          <h4 className="slds-text-title_caps slds-m-top_xx-small">Browser Extension</h4>
          <p>
            <a
              href={APP_ROUTES.BROWSER_EXTENSION.ROUTE}
              target="_blank"
              className="slds-text-heading_x-small"
              rel="noreferrer"
              onClick={() => trackEvent(ANALYTICS_KEYS.browser_extension_link, { action: 'clicked', source: 'app_home' })}
            >
              Download Chrome or Firefox Extension
            </a>
          </p>
          {!hasExtensionAccess && (
            <>
              <p className="slds-m-top_xx-small">Use your favorite Jetstream features in any Salesforce Org with the browser extensions!</p>
              <ul className="slds-list_dotted slds-m-bottom_small">
                <li>Instant access to Jetstream from any Salesforce page on any Salesforce org you are logged in to</li>
                <li>
                  The browser extension operates 100% within your browser, none of your Salesforce data is processed by Jetstream servers
                </li>
              </ul>
            </>
          )}

          <p>
            <a href={APP_ROUTES.BROWSER_EXTENSION.DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
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
