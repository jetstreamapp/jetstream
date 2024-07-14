import { clearCacheForOrg } from '@jetstream/shared/data';
import { addOrg, isEnterKey, isEscapeKey } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  ButtonGroupContainer,
  Checkbox,
  ColorSwatchItem,
  ColorSwatches,
  Grid,
  GridCol,
  Icon,
  Input,
  Popover,
  SalesforceLogin,
  Spinner,
} from '@jetstream/ui';
import classNames from 'classnames';
import startCase from 'lodash/startCase';
import { Fragment, FunctionComponent, ReactNode, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { applicationCookieState, selectSkipFrontdoorAuth } from '../state-management/app-state';

const EMPTY_COLOR = '_none_';

const ORG_COLORS: ColorSwatchItem[] = [
  { id: EMPTY_COLOR, color: '#fff' },
  { id: '#D1D5DB', color: '#D1D5DB' },
  { id: '#6B7280', color: '#6B7280' },
  { id: '#EF4444', color: '#EF4444' },
  { id: '#FDE68A', color: '#FDE68A' },
  { id: '#F59E0B', color: '#F59E0B' },
  { id: '#10B981', color: '#10B981' },
  { id: '#60A5FA', color: '#60A5FA' },
  { id: '#1D4ED8', color: '#1D4ED8' },
  { id: '#8B5CF6', color: '#8B5CF6' },
  { id: '#DB2777', color: '#DB2777' },
];

function getColor(color: string) {
  return !color || color === EMPTY_COLOR ? null : color;
}

export interface OrgInfoPopoverProps {
  org: SalesforceOrgUi;
  loading?: boolean;
  disableOrgActions?: boolean;
  isReadOnly?: boolean;
  onAddOrg?: (org: SalesforceOrgUi, switchActiveOrg: boolean) => void;
  onRemoveOrg?: (org: SalesforceOrgUi) => void;
  onUpdateOrg?: (org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) => void;
}

function getOrgProp(serverUrl: string, org: SalesforceOrgUi, skipFrontDoorAuth: boolean, prop: keyof SalesforceOrgUi, label?: string) {
  label = label || startCase(prop);
  let value: string | number | boolean | ReactNode = org[prop];
  let tooltip = '';
  if (!value && prop !== 'orgIsSandbox') {
    return undefined;
  }
  if (prop === 'organizationId') {
    tooltip = String(value);
    value = (
      <SalesforceLogin
        serverUrl={serverUrl}
        skipFrontDoorAuth={skipFrontDoorAuth}
        org={org}
        returnUrl="/lightning/setup/CompanyProfileInfo/home"
        omitIcon
      >
        {value}
      </SalesforceLogin>
    );
  } else if (prop === 'userId') {
    tooltip = String(value);
    value = (
      <SalesforceLogin serverUrl={serverUrl} skipFrontDoorAuth={skipFrontDoorAuth} org={org} returnUrl={`/${value}`} omitIcon>
        {value}
      </SalesforceLogin>
    );
  } else if (prop === 'orgIsSandbox') {
    tooltip = String(value);
    value = <Checkbox id="is-org-sandbox" label="is-sandbox" checked={!!value} hideLabel disabled />;
  }
  return (
    <tr className="slds-hint-parent">
      <td>
        <div title={label}>{label}</div>
      </td>
      <td>
        <div title={tooltip || (value as string)} className="slds-truncate">
          {value}
        </div>
      </td>
    </tr>
  );
}

export const OrgInfoPopover: FunctionComponent<OrgInfoPopoverProps> = ({
  org,
  loading,
  disableOrgActions,
  isReadOnly = false,
  onAddOrg,
  onRemoveOrg,
  onUpdateOrg,
}) => {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [orgLabel, setOrgLabel] = useState(org.label || org.username);
  const [orgColor, setOrgColor] = useState(org.color || EMPTY_COLOR);
  const [removeOrgActive, setRemoveOrgActive] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [didClearCache, setDidClearCache] = useState(false);
  const hasError = !!org.connectionError;

  useEffect(() => {
    const tempIsDirty = orgLabel !== org.label;
    if (tempIsDirty !== isDirty) {
      setIsDirty(tempIsDirty);
    }
  }, [isDirty, org, orgLabel]);

  useEffect(() => {
    setOrgLabel(org.label);
    setOrgColor(org.color || EMPTY_COLOR);
  }, [org]);

  function handleFixOrg() {
    addOrg({ serverUrl: serverUrl, loginUrl: org.instanceUrl }, (addedOrg: SalesforceOrgUi) => {
      onAddOrg?.(addedOrg, true);
    });
  }

  function handleLabelChange(event: React.ChangeEvent<HTMLInputElement>) {
    setOrgLabel(event.target.value);
  }

  function handleLabelKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (isEscapeKey(event)) {
      handleReset();
    } else if (isDirty && isEnterKey(event)) {
      handleSave();
    }
  }

  function handleReset() {
    setOrgLabel(org.label);
  }

  function handleSave() {
    onUpdateOrg?.(org, { label: orgLabel, color: getColor(orgColor) });
  }

  function handleColorSelection(color: ColorSwatchItem) {
    setOrgColor(color.id);
    onUpdateOrg?.(org, { label: org.label, color: getColor(color.id) });
  }

  async function handleClearCache() {
    try {
      setDidClearCache(true);
      await clearCacheForOrg(org);
    } catch (ex) {
      // error
    }
  }

  function handlePopoverClose(isOpen: boolean) {
    if (!isOpen && isDirty) {
      setOrgLabel(org.username);
    }
  }

  return (
    <Popover
      placement="bottom-end"
      // size="full-width"
      // size="large"
      panelStyle={{ minWidth: '26.5rem', overflow: 'hidden' }}
      bodyClassName="slds-popover__body slds-p-around_none"
      containerClassName={hasError ? 'slds-popover_error' : undefined}
      inverseIcons={hasError}
      onChange={handlePopoverClose}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Org Info">
            Org Info
            {hasError && ' - Connection Error'}
          </h2>
        </header>
      }
      content={
        <div className="slds-is-relative slds-p-around_xx-small">
          {loading && <Spinner />}
          {hasError && (
            <div className="slds-p-around_x-small">
              <ButtonGroupContainer className="slds-button_stretch">
                <button className="slds-button slds-button_success slds-button_stretch" onClick={handleFixOrg} disabled={disableOrgActions}>
                  <Icon type="utility" icon="apex_plugin" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Fix Org
                </button>
              </ButtonGroupContainer>
            </div>
          )}
          {!hasError && (
            <div className="slds-p-around_xx-small">
              <ButtonGroupContainer className="slds-button_stretch">
                <SalesforceLogin
                  serverUrl={serverUrl}
                  skipFrontDoorAuth={skipFrontDoorAuth}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  org={org}
                  title="Login to Salesforce Home"
                  returnUrl="/lightning/page/home"
                >
                  Home Page
                </SalesforceLogin>
                <SalesforceLogin
                  serverUrl={serverUrl}
                  skipFrontDoorAuth={skipFrontDoorAuth}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  org={org}
                  returnUrl="/lightning/setup/SetupOneHome/home"
                  title="Login to Salesforce Setup Menu"
                >
                  Setup Menu
                </SalesforceLogin>
              </ButtonGroupContainer>
            </div>
          )}
          <table className="slds-table slds-table_header-hidden">
            <thead className="slds-assistive-text">
              <tr className="slds-line-height_reset">
                <th className="" scope="col">
                  <div className="slds-truncate" title="Org Property">
                    Property
                  </div>
                </th>
                <th className="" scope="col">
                  <div className="slds-truncate" title="Value">
                    Value
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {!isReadOnly && (
                <>
                  <tr className={classNames('slds-hint-parent', { 'active-item-yellow-bg': isDirty })}>
                    <td>
                      <div title="Label">Label</div>
                    </td>
                    <td>
                      <div className="slds-p-right_small">
                        <Input>
                          <input
                            className="slds-input"
                            onChange={handleLabelChange}
                            value={orgLabel}
                            onKeyDown={handleLabelKeyDown}
                            maxLength={100}
                          />
                        </Input>
                        {isDirty && (
                          <Grid className="slds-p-top_xx-small">
                            <button className="slds-button slds-button_brand" disabled={!orgLabel} onClick={handleSave}>
                              Save
                            </button>
                            <button className="slds-button slds-button_neutral" disabled={!orgLabel} onClick={handleReset}>
                              Undo
                            </button>
                          </Grid>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Color</td>
                    <td>
                      <ColorSwatches items={ORG_COLORS} selectedItem={orgColor} onSelection={handleColorSelection} />
                    </td>
                  </tr>
                </>
              )}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'orgName', 'Org Name')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'organizationId', 'Org Id')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'orgInstanceName', 'Instance')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'instanceUrl')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'orgOrganizationType', 'Org Type')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'orgIsSandbox', 'Is Sandbox')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'orgTrialExpirationDate', 'Trial Expiration')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'userId')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'username')}
              {getOrgProp(serverUrl, org, skipFrontDoorAuth, 'email')}
            </tbody>
          </table>
          <div className="slds-p-horizontal_xx-small slds-p-top_xx-small">
            <ButtonGroupContainer className="slds-button_stretch">
              <button
                className="slds-button slds-button_neutral slds-button_stretch"
                onClick={() => handleClearCache()}
                disabled={disableOrgActions || didClearCache}
                title="The list of objects and fields are cached in your browser to improve performance. If you do not see recent objects or fields you can clear the cache for the org."
              >
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Clear Org Cached Data
              </button>
            </ButtonGroupContainer>
          </div>
          {!isReadOnly && (
            <div className="slds-p-around_xx-small">
              {!removeOrgActive && (
                <ButtonGroupContainer className="slds-button_stretch">
                  <button
                    className={classNames('slds-button slds-button_stretch', {
                      'slds-button_text-destructive': !hasError,
                      'slds-button_destructive': hasError,
                    })}
                    onClick={() => setRemoveOrgActive(true)}
                    disabled={disableOrgActions}
                  >
                    <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Remove Org
                  </button>
                </ButtonGroupContainer>
              )}
              {removeOrgActive && (
                <Fragment>
                  <div className="slds-text-color_destructive slds-m-vertical_x-small">
                    <p className="slds-align_absolute-center">This action will remove this org from jetstream,</p>
                    <p className="slds-align_absolute-center">are you sure you want to continue?</p>
                  </div>
                  <Grid align="center">
                    <GridCol>
                      <button className="slds-button slds-button_neutral" onClick={() => setRemoveOrgActive(false)}>
                        Keep Org
                      </button>
                      <button className="slds-button slds-button_brand" onClick={() => onRemoveOrg?.(org)}>
                        Remove Org
                      </button>
                    </GridCol>
                  </Grid>
                </Fragment>
              )}
            </div>
          )}
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_icon',
      }}
    >
      <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left slds-current-color" omitContainer />
    </Popover>
  );
};

export default OrgInfoPopover;
