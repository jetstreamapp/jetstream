/** @jsx jsx */
import { jsx } from '@emotion/react';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { addOrg, isEnterKey, isEscapeKey } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, Checkbox, Grid, GridCol, Icon, Input, Popover, SalesforceLogin, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import startCase from 'lodash/startCase';
import { Fragment, FunctionComponent, ReactNode, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

export interface OrgInfoPopoverProps {
  org: SalesforceOrgUi;
  loading?: boolean;
  onAddOrg: (org: SalesforceOrgUi, replaceOrgUniqueId?: string) => void;
  onRemoveOrg: (org: SalesforceOrgUi) => void;
  onSaveLabel: (org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) => void;
}

function getOrgProp(serverUrl: string, org: SalesforceOrgUi, prop: keyof SalesforceOrgUi, label?: string) {
  label = label || startCase(prop);
  let value: string | number | boolean | ReactNode = org[prop];
  let tooltip: string;
  if (!value && prop !== 'orgIsSandbox') {
    return undefined;
  }
  if (prop === 'organizationId') {
    tooltip = String(value);
    value = (
      <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl="/lightning/setup/CompanyProfileInfo/home" omitIcon>
        {value}
      </SalesforceLogin>
    );
  } else if (prop === 'userId') {
    tooltip = String(value);
    value = (
      <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={`/${value}`} omitIcon>
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

export const OrgInfoPopover: FunctionComponent<OrgInfoPopoverProps> = ({ org, loading, onAddOrg, onRemoveOrg, onSaveLabel }) => {
  const [applicationState] = useRecoilState(applicationCookieState);
  const [orgLabel, setOrgLabel] = useState(org.label || org.username);
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
  }, [org]);

  function handleFixOrg() {
    addOrg(
      { serverUrl: applicationState.serverUrl, loginUrl: org.instanceUrl, replaceOrgUniqueId: org.uniqueId },
      (addedOrg: SalesforceOrgUi) => {
        let replaceOrgUniqueId = undefined;
        if (addedOrg.uniqueId !== org.uniqueId) {
          replaceOrgUniqueId = org.uniqueId;
        }
        onAddOrg(addedOrg, replaceOrgUniqueId);
      }
    );
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
    onSaveLabel(org, { label: orgLabel });
  }

  async function handleClearCache() {
    try {
      setDidClearCache(true);
      await clearCacheForOrg(org);
    } catch (ex) {
      // error
    }
  }

  function handlePopoverClose() {
    if (isDirty) {
      setOrgLabel(org.username);
    }
  }

  return (
    <Popover
      placement="bottom-end"
      size="full-width"
      bodyClassName="slds-popover__body slds-p-around_none"
      containerClassName={hasError ? 'slds-popover_error' : undefined}
      inverseIcons={hasError}
      onClose={handlePopoverClose}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Org Info">
            Org Info
            {hasError && ' - Connection Error'}
          </h2>
        </header>
      }
      content={
        <div className="slds-is-relative">
          {loading && <Spinner />}
          {hasError && (
            <div className="slds-p-around_xx-small">
              <ButtonGroupContainer className="slds-button_stretch">
                <button className="slds-button slds-button_success slds-button_stretch" onClick={handleFixOrg}>
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
                  serverUrl={applicationState.serverUrl}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  org={org}
                  title="Login to Salesforce Home"
                  returnUrl="/lightning/page/home"
                >
                  Home Page
                </SalesforceLogin>
                <SalesforceLogin
                  serverUrl={applicationState.serverUrl}
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
              <tr className={classNames('slds-hint-parent', { 'active-item-yellow-bg': isDirty })}>
                <td>
                  <div title="Label">Label</div>
                </td>
                <td>
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
                    <Grid align="spread">
                      <button className="slds-button" disabled={!orgLabel} onClick={handleReset}>
                        Undo
                      </button>
                      <button className="slds-button" disabled={!orgLabel} onClick={handleSave}>
                        Save
                      </button>
                    </Grid>
                  )}
                </td>
              </tr>
              {getOrgProp(applicationState.serverUrl, org, 'orgName', 'Org Name')}
              {getOrgProp(applicationState.serverUrl, org, 'organizationId', 'Org Id')}
              {getOrgProp(applicationState.serverUrl, org, 'orgInstanceName', 'Instance')}
              {getOrgProp(applicationState.serverUrl, org, 'instanceUrl')}
              {getOrgProp(applicationState.serverUrl, org, 'orgOrganizationType', 'Org Type')}
              {getOrgProp(applicationState.serverUrl, org, 'orgIsSandbox', 'Is Sandbox')}
              {getOrgProp(applicationState.serverUrl, org, 'orgTrialExpirationDate', 'Trial Expiration')}
              {getOrgProp(applicationState.serverUrl, org, 'userId')}
              {getOrgProp(applicationState.serverUrl, org, 'username')}
              {getOrgProp(applicationState.serverUrl, org, 'email')}
            </tbody>
          </table>
          <div className="slds-p-horizontal_xx-small slds-p-top_xx-small">
            <ButtonGroupContainer className="slds-button_stretch">
              <button
                className="slds-button slds-button_neutral slds-button_stretch"
                onClick={() => handleClearCache()}
                disabled={didClearCache}
                title="The list of objects and fields are cached in your browser to improve performance. If you do not see recent objects or fields you can clear the cache for the org."
              >
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Clear Org Cached Data
              </button>
            </ButtonGroupContainer>
          </div>
          <div className="slds-p-around_xx-small">
            {!removeOrgActive && (
              <ButtonGroupContainer className="slds-button_stretch">
                <button
                  className={classNames('slds-button slds-button_stretch', {
                    'slds-button_text-destructive': !hasError,
                    'slds-button_destructive': hasError,
                  })}
                  onClick={() => setRemoveOrgActive(true)}
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
                    <button className="slds-button slds-button_brand" onClick={() => onRemoveOrg(org)}>
                      Remove Org
                    </button>
                  </GridCol>
                </Grid>
              </Fragment>
            )}
          </div>
        </div>
      }
    >
      <button className="slds-button slds-button_icon">
        <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
      </button>
    </Popover>
  );
};

export default OrgInfoPopover;
