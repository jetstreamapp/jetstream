import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { addOrg, isEnterKey, isEscapeKey } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  ButtonGroupContainer,
  ColorSwatchItem,
  ColorSwatches,
  CopyToClipboard,
  Grid,
  GridCol,
  Icon,
  IconProps,
  Input,
  Popover,
  SalesforceLogin,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { useAtomValue } from 'jotai';
import isString from 'lodash/isString';
import startCase from 'lodash/startCase';
import { Fragment, FunctionComponent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { useAmplitude } from '..';

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
  /** Identifies where the popover was rendered from so org management usage can be attributed in analytics */
  source?: 'org-groups' | 'org-dropdown' | 'read-only';
  dropdownIconProps?: Partial<IconProps>;
  iconButtonClassName?: string;
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
      <>
        <SalesforceLogin
          className="slds-truncate"
          serverUrl={serverUrl}
          skipFrontDoorAuth={skipFrontDoorAuth}
          org={org}
          returnUrl="/lightning/setup/CompanyProfileInfo/home"
          omitIcon
        >
          {value}
        </SalesforceLogin>
        <CopyToClipboard content={String(value)} type="icon" size="small" className="slds-m-left_xx-small">
          {value}
        </CopyToClipboard>
      </>
    );
  } else if (prop === 'userId') {
    tooltip = String(value);
    value = (
      <>
        <SalesforceLogin
          className="slds-truncate"
          serverUrl={serverUrl}
          skipFrontDoorAuth={skipFrontDoorAuth}
          org={org}
          returnUrl={`/${value}`}
          omitIcon
        >
          {value}
        </SalesforceLogin>
        <CopyToClipboard content={String(value)} type="icon" size="small" className="slds-m-left_xx-small">
          {value}
        </CopyToClipboard>
      </>
    );
  } else if (prop === 'orgIsSandbox') {
    tooltip = value ? 'True' : 'False';
    value = (
      <Icon
        type="utility"
        icon={value ? 'check' : 'steps'}
        title={value ? 'True' : 'False'}
        className="slds-icon slds-icon_x-small"
        containerClassname={classNames('slds-icon_container slds-current-color', {
          'slds-icon-utility-steps': !value,
          'slds-icon-utility-check': value,
        })}
      />
    );
  } else if (['instanceUrl', 'username', 'email'].includes(prop)) {
    tooltip = String(value);
    value = (
      <>
        <span className="slds-truncate">{value}</span>
        <CopyToClipboard content={String(value)} type="icon" size="small" className="slds-m-left_xx-small">
          {value}
        </CopyToClipboard>
      </>
    );
  } else if (prop === 'orgTrialExpirationDate') {
    const date = parseISO(String(value));
    if (isValid(date)) {
      tooltip = date.toLocaleDateString();
      value = date.toLocaleDateString();
    }
  }

  return (
    <tr className="slds-hint-parent">
      <td>
        <div title={label}>{label}</div>
      </td>
      <td>
        <div
          css={css`
            white-space: pre-wrap;
            word-break: break-word;
          `}
          title={tooltip || (value as string)}
          className={isString(value) ? 'slds-truncate' : undefined}
        >
          {value}
        </div>
      </td>
    </tr>
  );
}

const POPOVER_PADDING = 8;
const POPOVER_MIN_WIDTH = 420;

export const OrgInfoPopover: FunctionComponent<OrgInfoPopoverProps> = ({
  org,
  loading,
  disableOrgActions,
  isReadOnly = false,
  source,
  dropdownIconProps,
  iconButtonClassName,
  onAddOrg,
  onRemoveOrg,
  onUpdateOrg,
}) => {
  const { trackEvent } = useAmplitude();
  const { serverUrl } = useAtomValue(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);
  const [orgLabel, setOrgLabel] = useState(org.label || org.username);
  const [orgColor, setOrgColor] = useState(org.color || EMPTY_COLOR);
  const [removeOrgActive, setRemoveOrgActive] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [didClearCache, setDidClearCache] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const removeOrgButtonRef = useRef<HTMLButtonElement>(null);
  const keepOrgButtonRef = useRef<HTMLButtonElement>(null);
  // The "Remove Org" button and the keep/confirm pair replace each other in the DOM, so the button
  // the user activated is gone by the time the next one renders — focus is moved after that render.
  const pendingRemoveFocusRef = useRef<'keep' | 'remove' | null>(null);
  const removeWarningId = useId();
  const hasError = !!org.connectionError;

  useEffect(() => {
    if (pendingRemoveFocusRef.current === 'keep') {
      keepOrgButtonRef.current?.focus();
    } else if (pendingRemoveFocusRef.current === 'remove') {
      removeOrgButtonRef.current?.focus();
    }
    pendingRemoveFocusRef.current = null;
  }, [removeOrgActive]);

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

  const { width: tableWidth, ref } = useResizeDetector({ handleHeight: false });
  const minWidth = Math.max(POPOVER_MIN_WIDTH, (tableWidth || 0) + POPOVER_PADDING);

  function handleFixOrg() {
    trackEvent(ANALYTICS_KEYS.sfdc_org_add_org, { source, isReconnect: true });
    addOrg({ serverUrl, loginUrl: org.instanceUrl, loginHint: org.username }, (addedOrg: SalesforceOrgUi) => {
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
    // Save/Undo buttons unmount once the label is no longer dirty, so move focus back to the input to avoid losing it
    labelInputRef.current?.focus();
  }

  function handleSave() {
    trackEvent(ANALYTICS_KEYS.sfdc_org_updated, { source, field: 'label' });
    onUpdateOrg?.(org, { label: orgLabel, color: getColor(orgColor) });
    // Save/Undo buttons unmount once the label is no longer dirty, so move focus back to the input to avoid losing it
    labelInputRef.current?.focus();
  }

  function handleColorSelection(color: ColorSwatchItem) {
    trackEvent(ANALYTICS_KEYS.sfdc_org_updated, { source, field: 'color', clearedColor: !getColor(color.id) });
    setOrgColor(color.id);
    onUpdateOrg?.(org, { label: org.label, color: getColor(color.id) });
  }

  async function handleClearCache() {
    trackEvent(ANALYTICS_KEYS.sfdc_org_clear_cache, { source });
    try {
      setDidClearCache(true);
      await clearCacheForOrg(org);
    } catch {
      // error
    }
  }

  function handleStartRemoveOrg() {
    pendingRemoveFocusRef.current = 'keep';
    setRemoveOrgActive(true);
  }

  function handleKeepOrg() {
    pendingRemoveFocusRef.current = 'remove';
    setRemoveOrgActive(false);
  }

  function handleRemoveOrg() {
    trackEvent(ANALYTICS_KEYS.sfdc_org_removed, { source, hasConnectionError: hasError });
    onRemoveOrg?.(org);
  }

  function handlePopoverClose(isOpen: boolean) {
    if (isOpen) {
      trackEvent(ANALYTICS_KEYS.sfdc_org_info_opened, { source, isReadOnly, hasConnectionError: hasError });
    }
    if (!isOpen && isDirty) {
      setOrgLabel(org.username);
    }
  }

  return (
    <Popover
      size="large"
      panelStyle={{ minWidth: `${minWidth}px` }}
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
                  Reconnect Org
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
          <table ref={ref} className="slds-table slds-table_header-hidden">
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
                        <Input id="org-label" hideLabel label="Label">
                          <input
                            ref={labelInputRef}
                            id="org-label"
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
            <Tooltip
              className="w-100"
              content="Object and field metadata are cached in your browser to improve performance. Clear the cache if you recently added objects or fields."
            >
              <button
                className="slds-button slds-button_neutral slds-button_stretch"
                onClick={() => handleClearCache()}
                disabled={disableOrgActions || didClearCache}
              >
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Clear Cached Data
              </button>
            </Tooltip>
          </div>
          {!isReadOnly && (
            <div className="slds-p-around_xx-small">
              {!removeOrgActive && (
                <ButtonGroupContainer className="slds-button_stretch">
                  <button
                    ref={removeOrgButtonRef}
                    className={classNames('slds-button slds-button_stretch', {
                      'slds-button_text-destructive': !hasError,
                      'slds-button_destructive': hasError,
                    })}
                    onClick={handleStartRemoveOrg}
                    disabled={disableOrgActions}
                  >
                    <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Remove Org
                  </button>
                </ButtonGroupContainer>
              )}
              {removeOrgActive && (
                <Fragment>
                  <div id={removeWarningId} className="slds-text-color_destructive slds-m-vertical_x-small">
                    <p className="slds-align_absolute-center">This action will remove this org from jetstream,</p>
                    <p className="slds-align_absolute-center">are you sure you want to continue?</p>
                  </div>
                  <Grid align="center">
                    <GridCol>
                      {/* Focus lands on these straight from the button that opened them, so the warning
                          above is attached as their description rather than relying on it being read in order */}
                      <button
                        ref={keepOrgButtonRef}
                        className="slds-button slds-button_neutral"
                        aria-describedby={removeWarningId}
                        onClick={handleKeepOrg}
                      >
                        Keep Org
                      </button>
                      <button
                        className="slds-button slds-button_brand"
                        aria-describedby={removeWarningId}
                        onClick={() => handleRemoveOrg()}
                      >
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
        className: iconButtonClassName || 'slds-button slds-button_icon',
        'aria-label': 'Salesforce org details',
        'data-testid': 'org-info-popover-button',
      }}
    >
      <Icon type="utility" icon="settings" className="slds-button__icon slds-current-color" omitContainer {...dropdownIconProps} />
    </Popover>
  );
};
