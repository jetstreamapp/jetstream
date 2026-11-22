import { css } from '@emotion/react';
import { IconName, IconType } from '@jetstream/icon-factory';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isAccessProfileSurfaceAllowed } from '@jetstream/types';
import { Badge, Icon, ScopedNotification } from '@jetstream/ui';
import { abilityState, userProfileState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { Fragment, useMemo } from 'react';
import { Link } from 'react-router';
import { AppHomeAlternativeApplicationFormats } from './AppHomeAlternativeApplicationFormats';

interface HomeCard {
  title: string;
  icon: { type: string; icon: string };
  items: (typeof APP_ROUTES)[keyof typeof APP_ROUTES][];
}

const CURRENT_TIME = new Date().getTime();

/**
 * Home page for members without access to Jetstream's tools in the web app: the billing role, and members whose
 * team access profile excludes the web application.
 */
export const AppHomeReadOnlyUser = () => {
  const ability = useAtomValue(abilityState);
  const userProfile = useAtomValue(userProfileState);
  const accessProfile = userProfile.teamMembership?.accessProfile;
  // The billing role never has tools, so only explain the restriction to other members, matching the ACL
  const isWebAppRestricted = userProfile.teamMembership?.role !== 'BILLING' && !isAccessProfileSurfaceAllowed(accessProfile, 'web');
  const hasOtherApplication =
    isAccessProfileSurfaceAllowed(accessProfile, 'desktop') || isAccessProfileSurfaceAllowed(accessProfile, 'browser-extension');

  const homeCards = useMemo(() => {
    const cards: HomeCard[] = [];
    if (ability.can('read', 'Profile')) {
      cards.push({ title: 'Manage Profile', icon: { type: 'standard', icon: 'user' }, items: [APP_ROUTES.PROFILE] });
    }
    if (ability.can('read', 'Settings')) {
      cards.push({ title: 'Manage Settings', icon: { type: 'standard', icon: 'settings' }, items: [APP_ROUTES.SETTINGS] });
    }
    if (ability.can('read', 'Billing')) {
      cards.push({ title: 'Manage Billing', icon: { type: 'standard', icon: 'billing' }, items: [APP_ROUTES.BILLING] });
    }
    if (ability.can('read', 'Team')) {
      cards.push({ title: 'Manage Team', icon: { type: 'standard', icon: 'team_member' }, items: [APP_ROUTES.TEAM_DASHBOARD] });
    }
    return cards;
  }, [ability]);

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
      {/* The page has no visible title — give screen reader users a heading to land on and outline from */}
      <h1 className="slds-assistive-text">Home</h1>
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
        {isWebAppRestricted && <WebAppRestrictedNotice hasOtherApplication={hasOtherApplication} />}
        {homeCards.map((card) => (
          <div key={card.title} className="slds-card slds-box_x-small">
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
                          <dd className="slds-item_detail">
                            <a href={DOCS} target="_blank" className="slds-text-body_small" rel="noreferrer">
                              Documentation
                              <Icon
                                type="utility"
                                icon="help_doc_ext"
                                className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                                omitContainer
                              />
                            </a>
                          </dd>
                        )}
                      </Fragment>
                    ))}
                  </dl>
                </div>
              </div>
            </article>
          </div>
        ))}
        {isWebAppRestricted && <AppHomeAlternativeApplicationFormats />}
      </div>
    </div>
  );
};

function WebAppRestrictedNotice({ hasOtherApplication }: { hasOtherApplication: boolean }) {
  return (
    <ScopedNotification
      theme="info"
      css={css`
        grid-column: 1 / -1;
      `}
    >
      <h2 className="slds-text-heading_small">Web access is restricted</h2>
      <p>
        Your team's access profile does not include the Jetstream web application, so you can't connect Salesforce orgs or use Jetstream
        tools here. You can still manage your profile and settings.
      </p>
      <p>
        {hasOtherApplication
          ? 'Use one of the applications below, or ask a team admin if you need access to the web application.'
          : 'Your access profile does not include any Jetstream application, ask a team admin if you need access.'}
      </p>
    </ScopedNotification>
  );
}
