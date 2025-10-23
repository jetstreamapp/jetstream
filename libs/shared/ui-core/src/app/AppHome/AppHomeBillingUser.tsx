import { css } from '@emotion/react';
import { IconName, IconType } from '@jetstream/icon-factory';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Badge, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

const HOME_ITEMS = [
  {
    title: 'Manage Profile',
    icon: { type: 'standard', icon: 'user' },
    items: [APP_ROUTES.PROFILE],
  },
  {
    title: 'Manage Billing',
    icon: { type: 'standard', icon: 'billing' },
    items: [APP_ROUTES.BILLING],
  },
  {
    title: 'Manage Team',
    icon: { type: 'standard', icon: 'team_member' },
    items: [APP_ROUTES.TEAM_DASHBOARD],
  },
];

const CURRENT_TIME = new Date().getTime();

export const AppHomeBillingUser = () => {
  return (
    <div
      className="slds-m-top_small"
      css={css`
        min-width: 300px;
        max-width: calc(33em * 3);
        overflow-x: auto;
        margin-left: auto;
        margin-right: auto;

        @media (max-width: 768px) {
          max-width: 100%;
        }
      `}
    >
      <div
        css={css`
          display: grid;
          gap: 1em;
          grid-template-columns: repeat(3, minmax(5em, 30em));
          justify-content: center;

          @media (max-width: 1024px) {
            grid-template-columns: repeat(2, minmax(5em, 30em));
          }

          @media (max-width: 768px) {
            grid-template-columns: repeat(1, minmax(5em, 30em));
          }
        `}
      >
        {HOME_ITEMS.map((card) => (
          <div
            key={card.title}
            className="slds-box slds-box_x-small"
            css={css`
              background-color: white;
            `}
          >
            <article className="slds-tile slds-media">
              <div className="slds-media__figure">
                {card.icon && (
                  <Icon
                    type={card.icon.type as IconType}
                    icon={card.icon.icon as IconName}
                    containerClassname="slds-icon_container"
                    className={classNames(
                      'slds-icon slds-icon_small',
                      `slds-icon-${card.icon.type}-${card.icon.icon.replaceAll('_', '-')}`,
                    )}
                  />
                )}
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
                  {card.title}
                </h3>
                <div className="slds-tile__detail slds-p-bottom_small">
                  <dl className="slds-list_vertical slds-wrap">
                    {card.items.map(({ DESCRIPTION, ROUTE, SEARCH_PARAM, TITLE, DOCS, NEW_UNTIL }) => (
                      <Fragment key={ROUTE}>
                        <dt
                          className="slds-item_label slds-text-color_weak slds-truncate slds-p-top_small"
                          css={css`
                            line-height: 1.2rem;
                          `}
                        >
                          <Link to={{ pathname: ROUTE, search: SEARCH_PARAM }} className="slds-text-heading_small">
                            {TITLE}
                          </Link>
                          {NEW_UNTIL && NEW_UNTIL >= CURRENT_TIME && (
                            <Badge type="success" className="slds-m-left_xx-small">
                              NEW
                            </Badge>
                          )}
                        </dt>
                        <dd className="slds-item_detail">{DESCRIPTION}</dd>
                        {DOCS && (
                          <a href={DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
                            Documentation
                            <Icon
                              type="utility"
                              icon="help_doc_ext"
                              className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                              omitContainer
                            />
                          </a>
                        )}
                      </Fragment>
                    ))}
                  </dl>
                </div>
              </div>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
};
