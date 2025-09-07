// FIXME: we should try to minimize the dependencies in the web extension - this pulls in chevrotain and a bunch of other stuff
// Maybe we can split some code into multiple libraries?
/* eslint-disable no-restricted-globals */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useInterval } from '@jetstream/shared/ui-utils';
import type { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, OutsideClickHandler, Tabs } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import '../sfdc-styles-shim.scss';
import { chromeStorageOptions, chromeSyncStorage } from '../utils/extension.store';
import { getRecordPageObject, getRecordPageRecordId, sendMessage } from '../utils/web-extension.utils';
import JetstreamIcon from './icons/JetstreamIcon';
import JetstreamLogo from './icons/JetstreamLogo';
import { SfdcPageButtonOrgInfo } from './SfdcPageButtonOrgInfo';
import { SfdcPageButtonRecordSearch } from './SfdcPageButtonRecordSearch';
import { SfdcPageButtonUserSearch } from './SfdcPageButtonUserSearch';
interface PageLink {
  link: string;
  label: string;
  includeCurrentRecord?: boolean;
}

const PAGE_LINKS: PageLink[] = [
  {
    link: APP_ROUTES.QUERY.ROUTE,
    label: 'Query Records',
    includeCurrentRecord: true,
  },
  {
    link: APP_ROUTES.LOAD.ROUTE,
    label: 'Load Records',
    includeCurrentRecord: true,
  },
  {
    link: APP_ROUTES.AUTOMATION_CONTROL.ROUTE,
    label: 'Automation Control',
  },
  {
    link: APP_ROUTES.PERMISSION_MANAGER.ROUTE,
    label: 'Manage Permissions',
  },
  {
    link: APP_ROUTES.DEPLOY_METADATA.ROUTE,
    label: 'Deploy and View Metadata',
  },
  {
    link: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE,
    label: 'View Debug Logs',
  },
  {
    link: APP_ROUTES.ANON_APEX.ROUTE,
    label: 'Anonymous Apex',
  },
];

const ItemColStyles = css`
  padding-right: var(--lwc-spacingSmall, 0.75rem);
  padding-left: var(--lwc-spacingSmall, 0.75rem);
  margin-bottom: var(--lwc-spacingXSmall, 0.5rem);
  flex: 1 1 auto;
`;

const HorizontalRule = () => {
  return (
    <hr
      className="slds-m-vertical_medium"
      css={css`
        margin-top: 0.5rem;
        margin-bottom: 1rem;
        display: block;
        border: 0;
        border-top: 1px solid rgb(229, 229, 229);
        height: 1px;
        clear: both;
        padding: 0;
        box-sizing: content-box;
        width: 100%;
      `}
    />
  );
};

function getActionLink(sfHost: string, pageLink: PageLink, objectName?: string) {
  const searchParams = new URLSearchParams({ host: sfHost, url: pageLink.link });

  if (pageLink.includeCurrentRecord && objectName) {
    if (objectName) {
      searchParams.set('url', `${pageLink.link}?objectName=${objectName}`);
    }
  }
  return `${browser.runtime.getURL('app.html')}?${searchParams.toString()}`;
}

export function SfdcPageButton() {
  const currentPathname = useRef<string>(location.pathname);
  const options = useAtomValue(chromeStorageOptions);
  const { authTokens, buttonPosition } = useAtomValue(chromeSyncStorage);
  const [isOnSalesforcePage] = useState(
    () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com'),
  );

  const [sfHost, setSfHost] = useState<Maybe<string>>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [recordId, setRecordId] = useState(() => getRecordPageRecordId(location.pathname));
  const [objectName, setObjectName] = useState(() => getRecordPageObject(location.pathname));
  const [org, setOrg] = useState<SalesforceOrgUi | null>(null);

  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetAtom(fromAppState.salesforceOrgsState);

  useEffect(() => {
    try {
      sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
        logger.error('Error logging in', err);
      });
    } catch (err) {
      logger.error(err);
    }
  }, []);

  // TODO: figure out if there is a better way to listen for url change events
  useInterval(() => {
    if (currentPathname.current === location.pathname) {
      return;
    }
    currentPathname.current = location.pathname;
    setRecordId(() => getRecordPageRecordId(location.pathname));
    setObjectName(() => getRecordPageObject(location.pathname));
  }, 5000);

  useEffect(() => {
    if (isOnSalesforcePage) {
      sendMessage({
        message: 'GET_SF_HOST',
        data: { url: location.href },
      })
        .then((salesforceHost) => {
          setSfHost(salesforceHost);
          (async () => {
            try {
              if (salesforceHost) {
                const sessionInfo = await sendMessage({
                  message: 'GET_SESSION',
                  data: { salesforceHost },
                });
                logger.log('sessionInfo', sessionInfo);
                if (sessionInfo) {
                  const { org } = await sendMessage({
                    message: 'INIT_ORG',
                    data: { sessionInfo },
                  });
                  setOrg(org);
                  setSalesforceOrgs([org]);
                  setSelectedOrgId(org.uniqueId);
                }
              }
            } catch (ex) {
              logger.error('Error initializing org', ex);
            }
          })();
        })
        .catch((err) => {
          logger.log(err);
        });
    }
  }, [isOnSalesforcePage, setSalesforceOrgs, setSelectedOrgId]);

  if (!options.enabled || !authTokens?.loggedIn) {
    return null;
  }

  // don't show the button in iframes
  if (window.self !== window.top) {
    return null;
  }

  if (!isOnSalesforcePage || !sfHost || !org) {
    return null;
  }

  return (
    <>
      <button
        data-testid="jetstream-ext-page-button"
        css={css`
          z-index: 1000;
          display: ${isOpen ? 'none' : 'block'};
          position: fixed;
          vertical-align: middle;
          pointer: cursor;
          top: clamp(1px, ${buttonPosition.position}px, 100vh);
          ${buttonPosition.location}: ${isOpen ? '0px' : '-5px'};
          opacity: ${isOpen ? '1' : `${buttonPosition.opacity}`};
          width: ${buttonPosition.inactiveSize}px;
          transition: transform 0.3s ease;
          transform: ${isOpen ? `scale(${buttonPosition.activeScale})` : 'scale(1)'};
          transform-origin: top ${buttonPosition.location};

          background: none;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          outline: none;
          text-align: center;

          &:hover {
            opacity: 1;
            ${buttonPosition.location}: 0px;
            transform: scale(${buttonPosition.activeScale});
          }
        `}
        onClick={() => setIsOpen(true)}
      >
        <JetstreamIcon />
      </button>
      {isOpen && (
        <OutsideClickHandler
          css={css`
            z-index: 1000;
            display: block;
            position: fixed;
            top: clamp(1px, ${buttonPosition.position - 50}px, calc(100vh - 500px));
            ${buttonPosition.location}: 0;
            width: 300px;
            border-radius: var(--lwc-borderRadiusMedium, 0.25rem);
            min-height: 2rem;
            background-color: var(--slds-g-color-neutral-base-100, var(--lwc-colorBackgroundAlt, rgb(255, 255, 255)));
            box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.16);
            border: var(--lwc-borderWidthThin, 1px) solid var(--slds-g-color-border-base-1, var(--lwc-colorBorder, rgb(229, 229, 229)));
          `}
          onOutsideClick={() => setIsOpen(false)}
        >
          <div
            data-testid="jetstream-ext-popup-body"
            className="slds-popover__body slds-is-relative"
            css={css`
              position: relative;
              word-wrap: break-word;
            `}
          >
            <Tabs
              tabs={[
                {
                  id: 'actions',
                  title: 'Actions',
                  content: (
                    <Grid
                      vertical
                      gutters
                      css={css`
                        margin-right: calc(-1 * var(--lwc-spacingSmall, 0.75rem));
                        margin-left: calc(-1 * var(--lwc-spacingSmall, 0.75rem));
                        flex-direction: column;
                        display: flex;
                      `}
                    >
                      {PAGE_LINKS.map((item) => (
                        <GridCol key={item.link} className="slds-m-bottom_x-small" css={ItemColStyles}>
                          <a
                            href={getActionLink(sfHost, item, objectName)}
                            className="slds-button slds-button_neutral slds-button_stretch"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.label}
                          </a>
                        </GridCol>
                      ))}

                      <HorizontalRule />

                      {recordId && (
                        <>
                          <GridCol className="slds-m-bottom_x-small" css={ItemColStyles}>
                            <a
                              href={`${browser.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`}
                              className="slds-button slds-button_neutral slds-button_stretch"
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Current Record
                            </a>
                          </GridCol>
                          <GridCol className="slds-m-bottom_x-small" css={ItemColStyles}>
                            <a
                              href={`${browser.runtime.getURL('app.html')}?host=${sfHost}&action=EDIT_RECORD&actionValue=${recordId}`}
                              className="slds-button slds-button_neutral slds-button_stretch"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Edit Current Record
                            </a>
                          </GridCol>
                        </>
                      )}

                      {objectName && (
                        <GridCol className="slds-m-bottom_x-small" css={ItemColStyles}>
                          <a
                            href={`${browser.runtime.getURL('app.html')}?host=${sfHost}&action=CREATE_RECORD&actionValue=${objectName}`}
                            className="slds-button slds-button_neutral slds-button_stretch"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Create New Record
                          </a>
                        </GridCol>
                      )}

                      <GridCol className="slds-m-bottom_x-small" css={ItemColStyles}>
                        <SfdcPageButtonRecordSearch sfHost={sfHost} />
                      </GridCol>
                    </Grid>
                  ),
                },
                {
                  id: 'user-search',
                  title: 'User Search',
                  content: <SfdcPageButtonUserSearch sfHost={sfHost} />,
                },
                {
                  id: 'quick-links',
                  title: 'Quick Links',
                  content: <SfdcPageButtonOrgInfo org={org} />,
                },
              ]}
            />
          </div>
          <footer className="slds-popover__footer">
            <div className="slds-grid slds-grid_align-center slds-grid_vertical-align-center">
              <a
                href={`${browser.runtime.getURL('app.html')}?host=${sfHost}`}
                css={css`
                  width: 175px;
                  margin-bottom: 0;
                  cursor: pointer;
                  color: var(--lwc-brandTextLink, rgba(11, 92, 171, 1));
                  text-decoration: none;
                  transition: color 0.1s linear;
                  background-color: transparent;
                `}
                target="_blank"
                rel="noreferrer"
              >
                <JetstreamLogo />
              </a>
            </div>
          </footer>
        </OutsideClickHandler>
      )}
    </>
  );
}
