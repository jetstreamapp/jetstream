/* eslint-disable no-restricted-globals */
import { css } from '@emotion/react';
import { isValidSalesforceRecordId, useInterval } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Grid, GridCol, OutsideClickHandler } from '@jetstream/ui';
import { fromAppState, JetstreamIcon, JetstreamLogo } from '@jetstream/ui-core';
import { sendMessage } from '@jetstream/web-extension-utils';
import { useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

let currentPathname: string | undefined;
let currentRecordId: string | undefined;

function getRecordPageRecordId() {
  const pathname = location.pathname;
  if (pathname === currentPathname) {
    return currentRecordId;
  }
  currentPathname = pathname;
  let recordId: string | undefined;
  if (/\/[a-z0-9_]+\/[a-z0-9]{18}\/view$/i.test(pathname)) {
    // extract the record id by matching [a-zA-Z0-9]{18}
    recordId = pathname.match(/[a-zA-Z0-9]{18}/i)?.[0];
  } else if (/^\/[a-zA-Z0-9]{15}$/.test(pathname)) {
    recordId = pathname.match(/\/[a-z0-9]{15}$/i)?.[0];
  }
  if (isValidSalesforceRecordId(recordId)) {
    currentRecordId = recordId;
    return recordId;
  }
  return recordId;
}

const PAGE_LINKS = [
  {
    link: '/query',
    label: 'Query Records',
  },
  {
    link: '/load',
    label: 'Load Records',
  },
  {
    link: '/automation-control',
    label: 'Automation Control',
  },
  {
    link: '/permissions-manager',
    label: 'Manage Permissions',
  },
  {
    link: '/deploy-metadata',
    label: 'Deploy and Compare Metadata',
  },
  {
    link: '/apex',
    label: 'Anonymous Apex',
  },
];
export function Button() {
  const [isOnSalesforcePage] = useState(
    () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')
  );
  /**
   * TODO: Should we make the user sign in instead of using cookies?
   * increases friction, but more secure
   */
  const [sfHost, setSfHost] = useState<Maybe<string>>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [recordId, setRecordId] = useState(() => getRecordPageRecordId());
  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);

  // check to see if the url changed and update the id
  // TODO: figure out if there is a better way to listen for url change events
  useInterval(() => setRecordId(getRecordPageRecordId), 5000);

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
                console.log('sessionInfo', sessionInfo);
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
              console.error(ex);
              // FIXME: we need to tell the user there was a problem - most likely they are not logged in
            }
          })();
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }, [isOnSalesforcePage, setSalesforceOrgs, setSelectedOrgId]);

  if (!isOnSalesforcePage || !sfHost) {
    return null;
  }

  return (
    <>
      <button
        css={css`
        z-index: 1000;
        display: block;
        position: fixed;
        vertical-align: middle;
        pointer: cursor;
        top: 160px;
        right: ${isOpen ? '0px;' : '-5px;'};
        opacity: ${isOpen ? '1;' : '0.25;'};
        width: 25px;
        transition: transform 0.3s ease;
        transform: ${isOpen ? 'scale(1.5);' : 'scale(1);'}
        transform-origin: top right;

        background: none;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        outline: none;
        text-align: center;

        &:hover {
          opacity: 1;
          right: 0px;
          transform: scale(1.5);
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
            top: 160px;
            right: 0;
            width: 250px;
          `}
          className="slds-popover"
          onOutsideClick={() => setIsOpen(false)}
        >
          <header className="slds-p-left_medium slds-p-around_small slds-grid">
            <a
              href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}`}
              css={css`
                width: 100%;
              `}
              target="_blank"
              rel="noreferrer"
            >
              <JetstreamLogo />
            </a>
          </header>
          <div className="slds-popover__body slds-p-around_small slds-is-relative">
            <Grid vertical gutters>
              {PAGE_LINKS.map((item) => (
                <GridCol key={item.link} className="slds-m-bottom_x-small">
                  <a
                    href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&url=${encodeURIComponent(item.link)}`}
                    className="slds-button slds-button_neutral slds-button_stretch"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                </GridCol>
              ))}
              {recordId && (
                <>
                  <hr className="slds-m-vertical_medium" />
                  <GridCol className="slds-m-bottom_x-small">
                    <a
                      href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`}
                      className="slds-button slds-button_neutral slds-button_stretch"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Current Record
                    </a>
                  </GridCol>
                  <GridCol className="slds-m-bottom_x-small">
                    <a
                      href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&action=EDIT_RECORD&actionValue=${recordId}`}
                      className="slds-button slds-button_neutral slds-button_stretch"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Edit Current Record
                    </a>
                  </GridCol>
                </>
              )}
            </Grid>
          </div>
        </OutsideClickHandler>
      )}
    </>
  );
}

export default Button;
