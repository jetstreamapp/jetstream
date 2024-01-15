import { SerializedStyles, css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { addOrg, getOrgType, isEnterKey, isEscapeKey } from '@jetstream/shared/ui-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
  Badge,
  ButtonGroupContainer,
  ColorSwatchItem,
  ColorSwatches,
  CopyToClipboard,
  DropDown,
  FileDownloadModal,
  Grid,
  GridCol,
  Icon,
  Input,
  SalesforceLogin,
  Spinner,
  fireToast,
} from '@jetstream/ui';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import { OrgImportHistoryModal } from './OrgImportHistoryModal';
import { exportOrgHistory, generateHistoryFile } from './org-list.utils';

function getSelectedItemStyle(color?: Maybe<string>, connectionError?: Maybe<string>): SerializedStyles | undefined {
  if (!color || !!connectionError) {
    return css({
      width: '360px',
    });
  }
  return css({
    width: '360px',
    borderColor: `${color} !important`,
    boxShadow: `inset 0 0 0 1px ${color} !important`,
    backgroundClip: 'padding-box !important',
  });
}

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

interface OrgListItemProps {
  org: SalesforceOrgUi;
  onRefreshOrgInfo: (org: SalesforceOrgUi) => Promise<void>;
  onVerifyOrg: (org: SalesforceOrgUi) => Promise<void>;
  onRemoveOrg: (org: SalesforceOrgUi) => Promise<void>;
  onUpdateOrg: (org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) => Promise<void>;
}
export function OrgListItem({ org, onRefreshOrgInfo, onVerifyOrg, onRemoveOrg, onUpdateOrg }: OrgListItemProps) {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId, serverUrl }] = useRecoilState(applicationCookieState);

  const [listItemStyle, setListItemStyle] = useState(() => getSelectedItemStyle(org.color, org.connectionError));
  const [orgType] = useState(() => getOrgType(org));
  const [labelEditMode, setLabelEditMode] = useState(false);
  const [orgLabel, setOrgLabel] = useState(org.label);
  const [orgColor, setOrgColor] = useState(org.color || EMPTY_COLOR);
  const [colorExpanded, setColorExpanded] = useState(false);
  const [removeOrgActive, setRemoveOrgActive] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [exportHistoryModalOpen, setExportHistoryModalOpen] = useState(false);
  const [importHistoryModalOpen, setImportHistoryModalOpen] = useState(false);

  const [exportFile, setExportFile] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tempIsDirty = orgLabel !== org.label;
    if (tempIsDirty !== isDirty) {
      setIsDirty(tempIsDirty);
    }
  }, [isDirty, org, orgLabel]);

  useEffect(() => {
    setOrgColor(org.color || EMPTY_COLOR);
  }, [org.color]);

  useEffect(() => {
    setOrgLabel(org.label);
  }, [org.label]);

  useEffect(() => {
    setListItemStyle(getSelectedItemStyle(orgColor, org.connectionError));
  }, [orgColor, org.connectionError]);

  useEffect(() => {
    setOrgLabel(org.label);
  }, [org.label]);

  function handleSave(closeEdit = false) {
    onUpdateOrg(org, { label: orgLabel, color: getColor(orgColor) });
    if (closeEdit) {
      setLabelEditMode(false);
    }
  }

  function handleLabelKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (isEscapeKey(event)) {
      setOrgLabel(org.label);
    } else if (isDirty && isEnterKey(event)) {
      handleSave(true);
    }
  }

  function handleColorSelection(color: ColorSwatchItem) {
    setOrgColor(color.id);
    onUpdateOrg(org, { label: org.label, color: getColor(color.id) });
  }

  async function handleClearCache() {
    try {
      await clearCacheForOrg(org);
    } catch (ex) {
      logger.warn('Error clearing cache for org', ex);
    }
  }

  async function handleExportHistory() {
    try {
      setLoading(true);
      const orgHistory = await exportOrgHistory(org);
      setExportFile(await generateHistoryFile(org, orgHistory));
      setExportHistoryModalOpen(true);
    } catch (ex) {
      logger.warn(ex);
      // TODO: rollbar?
      fireToast({
        message: `There was a problem exporting your org history.`,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function closeFileModal(canceled?: boolean) {
    setExportHistoryModalOpen(false);
    setExportFile(null);
    if (!canceled) {
      trackEvent(ANALYTICS_KEYS.org_list_exported_history);
    }
  }

  async function handleOrgAction(action: 'refresh' | 'verify' | 'import-history' | 'export-history' | 'clear-cache' | 'delete') {
    switch (action) {
      case 'refresh':
        setLoading(true);
        await onRefreshOrgInfo(org);
        setLoading(false);
        break;
      case 'verify':
        setLoading(true);
        await onVerifyOrg(org);
        setLoading(false);
        break;
      case 'export-history':
        handleExportHistory();
        break;
      case 'import-history':
        setImportHistoryModalOpen(true);
        break;
      case 'clear-cache':
        await handleClearCache();
        break;
      case 'delete':
        setRemoveOrgActive(true);
        break;
    }
  }

  function handleFixOrg() {
    addOrg({ serverUrl: serverUrl, loginUrl: org.instanceUrl }, (addedOrg: SalesforceOrgUi) => {
      // TODO: do I need to do anything here? Or does the org dropdown handle listening to global changes?
      // onAddOrg(addedOrg, true);
    });
  }

  const orgExtraData = [org.orgInstanceName, org.orgCountry, org.orgLanguageLocaleKey].filter((item) => !!item).join(' | ');

  return (
    <li key={org.uniqueId} className="slds-item read-only slds-card slds-is-relative" css={listItemStyle}>
      {loading && <Spinner />}
      {exportHistoryModalOpen && exportFile && (
        <FileDownloadModal
          modalHeader="Download Org History"
          org={org}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['org-history']}
          allowedTypes={['zip']}
          data={exportFile}
          onModalClose={(canceled) => closeFileModal(canceled)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {importHistoryModalOpen && <OrgImportHistoryModal onClose={() => setImportHistoryModalOpen(false)} org={org} />}
      <Grid align="spread">
        <p className="slds-truncate slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-p-vertical_xx-small">
          {/* <span className="slds-text-color_weak">{org.username}</span> */}
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
            {orgType}
          </Badge>
        </p>
        <DropDown
          buttonClassName="slds-button slds-button_icon slds-button_icon-x-small slds-button_icon-border-filled"
          position="right"
          items={[
            // { id: 're-authenticate', value: 'Re-Authenticate' },
            { id: 'refresh', value: 'Refresh Org Info' },
            { id: 'verify', value: 'Verify Connection', trailingDivider: true },
            { id: 'export-history', value: 'Export History' },
            { id: 'import-history', value: 'Import History', trailingDivider: true },
            { id: 'clear-cache', value: 'Clear Cached Data', trailingDivider: true },
            { id: 'delete', value: 'Delete', spanClassName: 'slds-text-color_error' },
          ]}
          onSelected={handleOrgAction}
        />
      </Grid>
      <p
        className="slds-p-right_xx-small slds-line-clamp_small slds-p-vertical_xx-small"
        title={orgLabel}
        css={css`
          word-break: break-all;
        `}
      >
        {!labelEditMode && (
          <>
            <span>{orgLabel}</span>
            <button className="slds-button slds-button_icon slds-m-left_xx-small" onClick={() => setLabelEditMode(true)}>
              <Icon className="slds-button__icon" type="utility" icon="edit" />
            </button>
          </>
        )}
      </p>

      {labelEditMode && (
        <Grid align="spread">
          <Input
            className="slds-grow"
            label="Label"
            hideLabel
            isRequired
            clearButton
            onClear={() => {
              setOrgLabel(org.label);
              setLabelEditMode(false);
            }}
          >
            <input
              className="slds-input"
              value={orgLabel}
              onChange={(event) => setOrgLabel(event.target.value)}
              onKeyDown={handleLabelKeyDown}
              disabled={false}
              maxLength={100}
              required
            />
          </Input>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small"
            title="Save"
            onClick={() => handleSave(true)}
          >
            <Icon icon="check" type="utility" omitContainer className="slds-button__icon slds-icon-text-light" description="Save"></Icon>
          </button>
        </Grid>
      )}

      {org.username !== org.label && <p className="slds-truncate">{org.username}</p>}
      <p className="slds-truncate slds-p-vertical_xx-small" title={org.organizationId}>
        <span className="slds-text-color_weak">{org.organizationId}</span>
        <CopyToClipboard content={org.organizationId} className="slds-m-left_xx-small" />
      </p>
      <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={orgExtraData}>
        <span className="slds-text-color_weak slds-m-right_x-small">{orgExtraData}</span>
      </p>
      <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={org.instanceUrl}>
        <SalesforceLogin serverUrl={serverUrl} omitIcon org={org} title="Login" returnUrl="/lightning/page/home">
          {org.instanceUrl}
        </SalesforceLogin>
      </p>
      {org.connectionError && (
        <div>
          <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={org.connectionError}>
            <span className="slds-text-color_error">{org.connectionError}</span>
          </p>
          <button className="slds-button slds-button_neutral slds-m-right_x-small" onClick={() => onVerifyOrg(org)}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Retry Connection
          </button>
        </div>
      )}
      <Grid
        css={css`
          height: 33px;
        `}
      >
        <button
          className="slds-button slds-button_icon slds-button_icon-container"
          onClick={() => setColorExpanded((priorState) => !priorState)}
        >
          <Icon type="utility" icon={colorExpanded ? 'chevronleft' : 'chevronright'} className="slds-button__icon" omitContainer />
        </button>
        {colorExpanded && <ColorSwatches items={ORG_COLORS} selectedItem={orgColor} onSelection={handleColorSelection} />}
      </Grid>

      {org.connectionError && (
        <>
          <p className="slds-text-color_error">
            <Icon type="utility" icon="warning" className="slds-icon slds-icon_x-small slds-icon-text-error slds-m-horizontal_xx-small" />
            {org.connectionError}
          </p>
          <div className="slds-p-around_xx-small">
            <ButtonGroupContainer className="slds-button_stretch">
              <button className="slds-button slds-button_success slds-button_stretch" onClick={handleFixOrg}>
                <Icon type="utility" icon="apex_plugin" className="slds-button__icon slds-button__icon_left" omitContainer />
                Fix Org
              </button>
            </ButtonGroupContainer>
          </div>
        </>
      )}

      {removeOrgActive && (
        <>
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
        </>
      )}

      <Grid></Grid>
    </li>
  );
}

export default OrgListItem;
