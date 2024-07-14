import { css } from '@emotion/react';
import { IconName, IconType } from '@jetstream/icon-factory';
import { Badge, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from './app-routes';

const HOME_ITEMS = [
  {
    title: 'Query',
    icon: { type: 'standard', icon: 'record_lookup' },
    items: [APP_ROUTES.QUERY],
  },
  {
    title: 'Load',
    icon: { type: 'standard', icon: 'data_streams' },
    items: [APP_ROUTES.LOAD, APP_ROUTES.LOAD_MULTIPLE, APP_ROUTES.LOAD_MASS_UPDATE],
  },
  {
    title: 'Automation',
    icon: { type: 'standard', icon: 'activations' },
    items: [APP_ROUTES.AUTOMATION_CONTROL],
  },
  {
    title: 'Permissions',
    icon: { type: 'standard', icon: 'portal' },
    items: [APP_ROUTES.PERMISSION_MANAGER],
  },
  {
    title: 'Deploy',
    icon: { type: 'standard', icon: 'asset_relationship' },
    items: [APP_ROUTES.DEPLOY_METADATA, APP_ROUTES.CREATE_FIELDS, APP_ROUTES.FORMULA_EVALUATOR],
  },
  {
    title: 'Developer Tools',
    icon: { type: 'standard', icon: 'apex' },
    items: [
      APP_ROUTES.ANON_APEX,
      APP_ROUTES.DEBUG_LOG_VIEWER,
      APP_ROUTES.OBJECT_EXPORT,
      APP_ROUTES.SALESFORCE_API,
      APP_ROUTES.PLATFORM_EVENT_MONITOR,
    ],
  },
];

const CURRENT_TIME = new Date().getTime();

export const AppHome = () => {
  return (
    <div
      className="slds-m-top_small"
      css={css`
        max-width: calc(33em * 3);
        margin-left: auto;
        margin-right: auto;
      `}
    >
      <div
        css={css`
          display: grid;
          gap: 1em;
          grid-template-columns: repeat(auto-fit, minmax(5em, 30em));
          justify-content: center;
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
                      `slds-icon-${card.icon.type}-${card.icon.icon.replaceAll('_', '-')}`
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
                    {card.items.map(({ DESCRIPTION, ROUTE, TITLE, DOCS, NEW_UNTIL }) => (
                      <Fragment key={ROUTE}>
                        <dt
                          className="slds-item_label slds-text-color_weak slds-truncate slds-p-top_small"
                          css={css`
                            line-height: 1.2rem;
                          `}
                        >
                          <Link to={ROUTE} className="slds-text-heading_small">
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
