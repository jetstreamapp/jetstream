import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Link } from 'react-router';

/**
 * Global-actions icon button linking to the Data History page — rendered in the header next to the
 * background-jobs icon so history is reachable from anywhere in the app.
 */
export const HeaderDataHistoryButton: FunctionComponent = () => {
  return (
    <Link
      to={{ pathname: APP_ROUTES.DATA_HISTORY.ROUTE, search: APP_ROUTES.DATA_HISTORY.SEARCH_PARAM }}
      className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__item-action"
      title={APP_ROUTES.DATA_HISTORY.DESCRIPTION}
    >
      <Icon type="utility" icon="clock" className="slds-button__icon slds-global-header__icon" omitContainer />
      <span className="slds-assistive-text">{APP_ROUTES.DATA_HISTORY.TITLE}</span>
    </Link>
  );
};

/**
 * Inline "View Data History" text link for feature surfaces that capture history (load options,
 * mass-update advanced options, settings).
 */
export const ViewDataHistoryLink: FunctionComponent<{ className?: string }> = ({ className }) => {
  return (
    <Link
      to={{ pathname: APP_ROUTES.DATA_HISTORY.ROUTE, search: APP_ROUTES.DATA_HISTORY.SEARCH_PARAM }}
      className={classNames('slds-grid slds-grid_vertical-align-center', className)}
      title={APP_ROUTES.DATA_HISTORY.DESCRIPTION}
    >
      <Icon
        type="utility"
        icon="clock"
        className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_xx-small"
        omitContainer
      />
      View Data History
    </Link>
  );
};
