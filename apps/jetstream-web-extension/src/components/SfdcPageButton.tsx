/* eslint-disable no-restricted-globals */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useInterval } from '@jetstream/shared/ui-utils';
import type { Maybe } from '@jetstream/types';
import { Grid, GridCol, OutsideClickHandler, Tabs } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import '../sfdc-styles-shim.scss';
import { chromeStorageOptions, chromeSyncStorage } from '../utils/extension.store';
import { getRecordPageRecordId, sendMessage } from '../utils/web-extension.utils';
import JetstreamIcon from './icons/JetstreamIcon';
import JetstreamLogo from './icons/JetstreamLogo';
import { SfdcPageButtonRecordSearch } from './SfdcPageButtonRecordSearch';
import { SfdcPageButtonUserSearch } from './SfdcPageButtonUserSearch';

const PAGE_LINKS = [
  {
    link: APP_ROUTES.QUERY.ROUTE,
    label: 'Query Records',
  },
  {
    link: APP_ROUTES.LOAD.ROUTE,
    label: 'Load Records',
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
    link: APP_ROUTES.ANON_APEX.ROUTE,
    label: 'Anonymous Apex',
  },
];

const ButtonLinkCss = css`
  :hover {
    --slds-c-button-color-background-hover: var(
      --slds-c-button-neutral-color-background-hover,
      var(
        --sds-c-button-neutral-color-background-hover,
        var(--slds-g-color-neutral-base-95, var(--lwc-colorBackgroundButtonDefaultHover, rgb(243, 243, 243)))
      )
    );
    --slds-c-button-color-border-hover: var(
      --slds-c-button-neutral-color-border-hover,
      var(
        --sds-c-button-neutral-color-border-hover,
        var(--slds-g-color-border-base-4, var(--lwc-buttonColorBorderPrimary, rgb(201, 201, 201)))
      )
    );
    --slds-c-button-color-border: var(--slds-c-button-color-border-hover);
    --slds-c-button-color-background: var(--slds-c-button-color-background-hover);
    color: var(
      --slds-c-button-text-color-hover,
      var(--sds-c-button-text-color-hover, var(--lwc-brandAccessibleActive, rgba(53, 93, 150, 1)))
    );
    text-decoration: none;
  }
  text-align: center;
  justify-content: center;
  width: 100%;
  transition: border 0.15s linear;
  --slds-c-button-color-background: var(
    --slds-c-button-neutral-color-background,
    var(
      --sds-c-button-neutral-color-background,
      var(--slds-g-color-neutral-base-100, var(--lwc-buttonColorBackgroundPrimary, rgb(255, 255, 255)))
    )
  );
  --slds-c-button-color-border: var(
    --slds-c-button-neutral-color-border,
    var(--sds-c-button-neutral-color-border, var(--slds-g-color-border-base-4, var(--lwc-buttonColorBorderPrimary, rgb(201, 201, 201))))
  );
  position: relative;
  display: inline-flex;
  align-items: center;
  padding-top: var(--slds-c-button-spacing-block-start, var(--sds-c-button-spacing-block-start, 0));
  padding-right: var(--slds-c-button-spacing-inline-end, var(--sds-c-button-spacing-inline-end, 0));
  padding-bottom: var(--slds-c-button-spacing-block-end, var(--sds-c-button-spacing-block-end, 0));
  padding-left: var(--slds-c-button-spacing-inline-start, var(--sds-c-button-spacing-inline-start, 0));
  background: none;
  background-color: var(--slds-c-button-color-background, var(--sds-c-button-color-background, transparent));
  background-clip: border-box;
  border-color: var(--slds-c-button-color-border, var(--sds-c-button-color-border, transparent));
  border-style: solid;
  border-width: var(--slds-c-button-sizing-border, var(--sds-c-button-sizing-border, var(--lwc-borderWidthThin, 1px)));
  border-radius: var(--slds-c-button-radius-border, var(--sds-c-button-radius-border, var(--lwc-buttonBorderRadius, 0.25rem)));
  box-shadow: var(--slds-c-button-shadow, var(--sds-c-button-shadow));
  line-height: var(--slds-c-button-line-height, var(--sds-c-button-line-height, var(--lwc-lineHeightButton, 1.875rem)));
  text-decoration: none;
  color: var(--slds-c-button-text-color, var(--sds-c-button-text-color, var(--lwc-brandAccessible, rgba(1, 118, 211, 1))));
  -webkit-appearance: none;
  white-space: normal;
  user-select: none;
  cursor: pointer;
`;

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

export function SfdcPageButton() {
  const options = useRecoilValue(chromeStorageOptions);
  const { authTokens, buttonPosition } = useRecoilValue(chromeSyncStorage);
  const [isOnSalesforcePage] = useState(
    () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')
  );

  const [sfHost, setSfHost] = useState<Maybe<string>>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [recordId, setRecordId] = useState(() => getRecordPageRecordId(location.pathname));

  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);

  useEffect(() => {
    try {
      sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
        logger.error('Error logging in', err);
      });
    } catch (err) {
      logger.error(err);
    }
  }, []);

  // check to see if the url changed and update the id
  // TODO: figure out if there is a better way to listen for url change events

  useInterval(() => setRecordId(() => getRecordPageRecordId(location.pathname)), 5000);

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

  if (!isOnSalesforcePage || !sfHost) {
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
          <header
            data-testid="jetstream-ext-popup-header"
            className="slds-p-left_medium slds-p-around_small slds-grid"
            css={css`
              padding: var(--lwc-spacingSmall, 0.75rem);
              display: flex;
            `}
          >
            <a
              href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}`}
              css={css`
                width: 100%;
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
          </header>
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
                            href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&url=${encodeURIComponent(item.link)}`}
                            className="slds-button slds-button_neutral slds-button_stretch"
                            target="_blank"
                            rel="noreferrer"
                            css={ButtonLinkCss}
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
                              href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`}
                              className="slds-button slds-button_neutral slds-button_stretch"
                              target="_blank"
                              rel="noreferrer"
                              css={ButtonLinkCss}
                            >
                              View Current Record
                            </a>
                          </GridCol>
                          <GridCol className="slds-m-bottom_x-small" css={ItemColStyles}>
                            <a
                              href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&action=EDIT_RECORD&actionValue=${recordId}`}
                              className="slds-button slds-button_neutral slds-button_stretch"
                              target="_blank"
                              rel="noreferrer"
                              css={ButtonLinkCss}
                            >
                              Edit Current Record
                            </a>
                          </GridCol>
                        </>
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
              ]}
            />
          </div>
        </OutsideClickHandler>
      )}
    </>
  );
}
