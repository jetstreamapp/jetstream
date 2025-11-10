import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Badge, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

const CURRENT_TIME = new Date().getTime();

export const AppHomeOrganizations = () => {
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
            icon="employee_organization"
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
            {APP_ROUTES.SALESFORCE_ORG_GROUPS.TITLE}
            {APP_ROUTES.SALESFORCE_ORG_GROUPS.NEW_UNTIL && APP_ROUTES.SALESFORCE_ORG_GROUPS.NEW_UNTIL >= CURRENT_TIME && (
              <Badge type="success" className="slds-m-left_xx-small">
                NEW
              </Badge>
            )}
          </h3>
          <Link
            to={{ pathname: APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE, search: APP_ROUTES.SALESFORCE_ORG_GROUPS.SEARCH_PARAM }}
            className="slds-text-heading_x-small"
          >
            Manage Groups
          </Link>
          <p>Group your Salesforce Orgs so that you can isolate which orgs you are working with.</p>

          <a href={APP_ROUTES.SALESFORCE_ORG_GROUPS.DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
            Documentation
            <Icon
              type="utility"
              icon="help_doc_ext"
              className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
              omitContainer
            />
          </a>
        </div>
      </article>
    </div>
  );
};
