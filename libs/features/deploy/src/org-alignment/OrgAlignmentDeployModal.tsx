import { css } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { formatNumber, getFilename, getOrgType, saveFile } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import {
  Badge,
  Checkbox,
  DisabledReasonButton,
  FileDownloadModal,
  Grid,
  GridCol,
  Icon,
  Modal,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { fromJetstreamEvents, OrgLabelBadge } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, useOperationAccess } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useMemo, useState } from 'react';
import DeployMetadataToOrgStatusModal from '../deploy-to-different-org/DeployMetadataToOrgStatusModal';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import { retrieveMetadataChunked } from '../view-or-compare-metadata/useViewOrCompareMetadata';
import { OrgAlignmentComponentItem, OrgAlignmentDeployDirection } from './orgAlignmentTypes';
import { componentsToListMetadataMap, getOverwrittenTargetComponentsMap } from './orgAlignmentUtils';
import { useDependencies } from './useDependencies';

const DISABLED_OPTIONS = new Set<keyof DeployOptions>(['allowMissingFiles', 'autoUpdatePackage', 'purgeOnDelete', 'singlePackage']);

export interface OrgAlignmentDeployModalProps {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  direction: OrgAlignmentDeployDirection;
  initialSelectedComponents: OrgAlignmentComponentItem[];
  allComponents: OrgAlignmentComponentItem[];
  /** Destination org listMetadata inventory keyed by metadata type */
  destinationInventoryByType: Record<string, ListMetadataResult[]>;
  onClose: () => void;
}

export const OrgAlignmentDeployModal: FunctionComponent<OrgAlignmentDeployModalProps> = ({
  sourceOrg,
  targetOrg,
  direction,
  initialSelectedComponents,
  allComponents,
  destinationInventoryByType,
  onClose,
}) => {
  const deployAccess = useOperationAccess('metadata.deploy');
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const deploySourceOrg = direction === 'A_TO_B' ? sourceOrg : targetOrg;
  const deployTargetOrg = direction === 'A_TO_B' ? targetOrg : sourceOrg;
  const isTargetProduction = getOrgType(deployTargetOrg) === 'Production';

  const [step, setStep] = useState<'DEPENDENCIES' | 'BACKUP_AND_OPTIONS' | 'DEPLOY'>('DEPENDENCIES');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(initialSelectedComponents.map(({ key }) => key)));

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupCompleted, setBackupCompleted] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [acknowledgeWithoutBackup, setAcknowledgeWithoutBackup] = useState(false);

  // Default to Validate Only (checkOnly: true) so users validate before syncing
  const [deployOptions, setDeployOptions] = useState<DeployOptions>({
    allowMissingFiles: false,
    autoUpdatePackage: false,
    checkOnly: true,
    ignoreWarnings: false,
    purgeOnDelete: false,
    rollbackOnError: true,
    singlePackage: true,
    testLevel: undefined,
    runTests: [],
  });
  const [deployRunId, setDeployRunId] = useState(0);
  const [optionsResetKey, setOptionsResetKey] = useState(0);
  const [hasRunValidation, setHasRunValidation] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState(false);
  const [deployResultsData, setDeployResultsData] = useState<Record<string, unknown[]>>();

  const allComponentsByKey = useMemo(() => new Map(allComponents.map((item) => [item.key, item])), [allComponents]);

  const selectedComponents = useMemo(
    () =>
      Array.from(selectedKeys)
        .map((key) => allComponentsByKey.get(key))
        .filter((item): item is OrgAlignmentComponentItem => Boolean(item)),
    [allComponentsByKey, selectedKeys],
  );

  const selectedMetadataMap = useMemo(() => componentsToListMetadataMap(selectedComponents, direction), [direction, selectedComponents]);

  const overwrittenTargetMap = useMemo(
    () => getOverwrittenTargetComponentsMap(selectedComponents, direction),
    [direction, selectedComponents],
  );

  const overwrittenCount = useMemo(
    () => Object.values(overwrittenTargetMap).reduce((total, items) => total + items.length, 0),
    [overwrittenTargetMap],
  );

  const {
    loading: dependenciesLoading,
    findings: dependencyFindings,
    missingCount,
    differsCount,
    externalCount,
    toolingApiError,
    recheck: recheckDependencies,
  } = useDependencies({
    deploySourceOrg,
    selectedComponents,
    allSourceComponents: allComponents,
    targetInventoryByType: destinationInventoryByType,
    direction,
    enabled: step === 'DEPENDENCIES',
  });

  const addableMissingKeys = useMemo(
    () =>
      Array.from(
        new Set(
          dependencyFindings
            .filter((finding) => finding.severity === 'missing' && finding.addableComponentKey)
            .map((finding) => finding.addableComponentKey as string),
        ),
      ),
    [dependencyFindings],
  );

  function toggleSelectedKey(key: string, checked: boolean) {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function handleIncludeDependency(componentKey: string) {
    setSelectedKeys((previous) => new Set([...previous, componentKey]));
  }

  function handleIncludeAllMissing() {
    setSelectedKeys((previous) => new Set([...previous, ...addableMissingKeys]));
  }

  async function handleDownloadTargetBackup() {
    if (overwrittenCount === 0) {
      setBackupCompleted(true);
      return;
    }
    setBackupLoading(true);
    setBackupError(null);
    try {
      const { zip } = await retrieveMetadataChunked(deployTargetOrg, overwrittenTargetMap);
      const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 5 } });
      const filename = `${getFilename(deployTargetOrg, ['org-alignment-backup'])}.zip`;
      saveFile(buffer, filename, MIME_TYPES.ZIP);
      setBackupCompleted(true);
    } catch (ex) {
      setBackupError(getErrorMessage(ex));
    } finally {
      setBackupLoading(false);
    }
  }

  function handleStartDeploy(overrideCheckOnly?: boolean) {
    const nextCheckOnly = typeof overrideCheckOnly === 'boolean' ? overrideCheckOnly : Boolean(deployOptions.checkOnly);
    if (typeof overrideCheckOnly === 'boolean') {
      setDeployOptions((previous) => ({ ...previous, checkOnly: overrideCheckOnly }));
    }
    if (nextCheckOnly) {
      setHasRunValidation(true);
    }
    setDeployRunId((previous) => previous + 1);
    setStep('DEPLOY');
  }

  function handleSwitchToActualDeploy() {
    setDeployOptions((previous) => ({ ...previous, checkOnly: false }));
    setOptionsResetKey((previous) => previous + 1);
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  const isOptionsValid =
    selectedComponents.length > 0 &&
    !(deployOptions.testLevel === 'RunSpecifiedTests' && (!deployOptions.runTests || deployOptions.runTests.length === 0));

  const backupSatisfied = overwrittenCount === 0 || backupCompleted || acknowledgeWithoutBackup;
  const canStartDeploy = deployAccess.allowed && isOptionsValid && (deployOptions.checkOnly || backupSatisfied);

  if (step === 'DEPLOY') {
    return (
      <Fragment>
        <DeployMetadataToOrgStatusModal
          key={deployRunId}
          hideModal={downloadResultsModalOpen}
          sourceOrg={deploySourceOrg}
          destinationOrg={deployTargetOrg}
          selectedMetadata={selectedMetadataMap}
          deployOptions={deployOptions}
          onGoBack={() => setStep('BACKUP_AND_OPTIONS')}
          onClose={onClose}
          onDownload={handleDeployResultsDownload}
        />
        {downloadResultsModalOpen && deployResultsData && (
          <FileDownloadModal
            modalHeader="Download Deploy Results"
            org={deployTargetOrg}
            googleIntegrationEnabled={hasGoogleDriveAccess}
            googleShowUpgradeToPro={googleShowUpgradeToPro}
            google_apiKey={google_apiKey}
            google_appId={google_appId}
            google_clientId={google_clientId}
            fileNameParts={['org-alignment-deploy-results']}
            allowedTypes={['xlsx']}
            data={deployResultsData}
            onModalClose={() => setDownloadResultsModalOpen(false)}
            emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          />
        )}
      </Fragment>
    );
  }

  const directionTagline = (
    <div className="slds-align_absolute-center">
      <span>Deploying from</span>
      <span className="slds-m-horizontal_xx-small">
        <OrgLabelBadge org={deploySourceOrg} />
      </span>
      <Icon type="utility" icon="forward" className="slds-icon slds-icon-text-default slds-icon_x-small" omitContainer />
      <span className="slds-m-left_xx-small">
        <OrgLabelBadge org={deployTargetOrg} />
      </span>
    </div>
  );

  if (step === 'DEPENDENCIES') {
    const groupedSelection = selectedComponents.reduce<Record<string, OrgAlignmentComponentItem[]>>((acc, item) => {
      acc[item.typeLabel] = acc[item.typeLabel] || [];
      acc[item.typeLabel].push(item);
      return acc;
    }, {});

    return (
      <Modal
        header="Pre-Deploy Review & Dependencies (Step 1 of 2)"
        tagline={directionTagline}
        size="lg"
        closeOnBackdropClick={false}
        footer={
          <Grid align="spread" verticalAlign="center">
            <div className="slds-text-body_small slds-text-color_weak">
              {formatNumber(selectedComponents.length)} {selectedComponents.length === 1 ? 'component' : 'components'} selected (
              {formatNumber(overwrittenCount)} will overwrite existing metadata in {deployTargetOrg.label})
            </div>
            <Grid>
              <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
                Cancel
              </button>
              <DisabledReasonButton
                className="slds-button slds-button_brand"
                disabled={!deployAccess.allowed || selectedComponents.length === 0}
                disabledReason={!deployAccess.allowed ? deployAccess.deniedReason : 'Select at least one component to deploy'}
                onClick={() => setStep('BACKUP_AND_OPTIONS')}
              >
                Continue to Backup &amp; Validate
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" omitContainer />
              </DisabledReasonButton>
            </Grid>
          </Grid>
        }
        onClose={onClose}
      >
        <Grid wrap>
          <GridCol size={12} sizeLarge={5} className="slds-p-right_small slds-border_right">
            <h3 className="slds-text-heading_small slds-m-bottom_x-small">
              Selected Components ({formatNumber(selectedComponents.length)})
            </h3>
            <div
              className="slds-scrollable_y"
              css={css`
                max-height: 48vh;
              `}
            >
              {Object.entries(groupedSelection).map(([typeLabel, items]) => (
                <div key={typeLabel} className="slds-m-bottom_small">
                  <div className="slds-text-title_caps slds-text-color_weak slds-m-bottom_xx-small">
                    {typeLabel} ({items.length})
                  </div>
                  {items.map((item) => {
                    const willOverwrite = direction === 'A_TO_B' ? Boolean(item.targetItem) : Boolean(item.sourceItem);
                    return (
                      <div key={item.key} className="slds-p-vertical_xxx-small">
                        <Checkbox
                          id={`align-deploy-select-${item.key}`}
                          checked={selectedKeys.has(item.key)}
                          onChange={(checked) => toggleSelectedKey(item.key, checked)}
                          label={
                            <span>
                              <span>{item.fullName}</span>
                              <Badge type={willOverwrite ? 'warning' : 'light'} className="slds-m-left_x-small">
                                {willOverwrite ? 'Overwrite' : 'New'}
                              </Badge>
                            </span>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </GridCol>

          <GridCol size={12} sizeLarge={7} className="slds-p-left_medium slds-is-relative">
            <Grid align="spread" verticalAlign="center" className="slds-m-bottom_x-small">
              <Grid verticalAlign="center">
                <h3 className="slds-text-heading_small">Dependency Check</h3>
                <Badge type="light" className="slds-m-left_x-small">
                  Best Effort
                </Badge>
              </Grid>
              <Grid>
                {addableMissingKeys.length > 0 && (
                  <button type="button" className="slds-button slds-button_brand slds-m-right_xx-small" onClick={handleIncludeAllMissing}>
                    Include {formatNumber(addableMissingKeys.length)} Missing
                  </button>
                )}
                <button
                  type="button"
                  className="slds-button slds-button_neutral"
                  disabled={dependenciesLoading}
                  onClick={recheckDependencies}
                >
                  Recheck
                </button>
              </Grid>
            </Grid>

            <ScopedNotification theme="light" className="slds-m-bottom_small">
              <strong>Best-effort check:</strong> Uses Salesforce&apos;s Tooling <code>MetadataComponentDependency</code> API and the target
              org&apos;s metadata list. Dynamic references, formulas, or types outside this comparison may not be detected, and false
              positives are possible. Always validate before deploying.
            </ScopedNotification>

            {toolingApiError && (
              <ScopedNotification theme="warning" className="slds-m-bottom_small">
                Tooling dependency API returned a warning ({toolingApiError}). Structural checks against the target org list are still shown
                below.
              </ScopedNotification>
            )}

            <div
              className="slds-is-relative slds-scrollable_y"
              css={css`
                max-height: 36vh;
                min-height: 120px;
              `}
            >
              {dependenciesLoading && <Spinner size="small" />}
              {!dependenciesLoading && dependencyFindings.length === 0 && (
                <ScopedNotification theme="success">No missing dependencies were detected for the selected components.</ScopedNotification>
              )}
              {!dependenciesLoading && dependencyFindings.length > 0 && (
                <Fragment>
                  <div className="slds-m-bottom_x-small">
                    {missingCount > 0 && (
                      <Badge type="error" className="slds-m-right_xx-small">
                        {formatNumber(missingCount)} potentially missing
                      </Badge>
                    )}
                    {differsCount > 0 && (
                      <Badge type="warning" className="slds-m-right_xx-small">
                        {formatNumber(differsCount)} differs in target
                      </Badge>
                    )}
                    {externalCount > 0 && <Badge type="light">{formatNumber(externalCount)} external / unverified</Badge>}
                  </div>
                  <ul className="slds-has-dividers_bottom-space">
                    {dependencyFindings.map((finding) => (
                      <li key={finding.key} className="slds-item slds-p-vertical_x-small">
                        <Grid align="spread" verticalAlign="start">
                          <div className="slds-grow slds-m-right_small">
                            <div>
                              <Badge
                                type={finding.severity === 'missing' ? 'error' : finding.severity === 'differs' ? 'warning' : 'light'}
                                className="slds-m-right_x-small"
                              >
                                {finding.severity === 'missing'
                                  ? 'Missing in Target'
                                  : finding.severity === 'differs'
                                    ? 'Differs in Target'
                                    : 'Verify'}
                              </Badge>
                              <strong>
                                {finding.referencedType}: {finding.referencedName}
                              </strong>
                            </div>
                            <div className="slds-text-body_small slds-text-color_weak slds-m-top_xxx-small">
                              Required by {finding.sourceComponentType}: {finding.sourceComponentName} — {finding.message}
                            </div>
                          </div>
                          {finding.addableComponentKey && !selectedKeys.has(finding.addableComponentKey) && (
                            <button
                              type="button"
                              className="slds-button slds-button_neutral"
                              onClick={() => handleIncludeDependency(finding.addableComponentKey as string)}
                            >
                              Add
                            </button>
                          )}
                        </Grid>
                      </li>
                    ))}
                  </ul>
                </Fragment>
              )}
            </div>
          </GridCol>
        </Grid>
      </Modal>
    );
  }

  return (
    <Modal
      header="Backup Target & Deploy Options (Step 2 of 2)"
      tagline={directionTagline}
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <Grid align="spread" verticalAlign="center">
          <button type="button" className="slds-button slds-button_neutral" onClick={() => setStep('DEPENDENCIES')}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Back to Dependencies
          </button>
          <Grid>
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Cancel
            </button>
            <DisabledReasonButton
              className="slds-button slds-button_brand"
              disabled={!canStartDeploy}
              disabledReason={
                !deployAccess.allowed
                  ? deployAccess.deniedReason
                  : !deployOptions.checkOnly && !backupSatisfied
                    ? 'Download a target org backup or acknowledge proceeding without a backup first'
                    : !isOptionsValid
                      ? 'Specify at least one test class when running specified tests'
                      : undefined
              }
              onClick={() => handleStartDeploy()}
            >
              {deployOptions.checkOnly ? 'Validate Deployment' : `Deploy to ${deployTargetOrg.label}`}
            </DisabledReasonButton>
          </Grid>
        </Grid>
      }
      onClose={onClose}
    >
      {isTargetProduction && (
        <ScopedNotification theme="warning" className="slds-m-bottom_small">
          <strong>Production target org:</strong> {deployTargetOrg.label} is a Production org. Validate Only is enabled by default —
          download a target backup and run validation before deploying.
        </ScopedNotification>
      )}

      <Grid wrap>
        <GridCol size={12} sizeLarge={6} className="slds-p-right_medium slds-border_right">
          <h3 className="slds-text-heading_small slds-m-bottom_x-small">1. Back Up Target Org</h3>
          {overwrittenCount === 0 ? (
            <ScopedNotification theme="success" className="slds-m-bottom_medium">
              All {formatNumber(selectedComponents.length)} selected components are new in {deployTargetOrg.label}. Nothing existing will be
              overwritten.
            </ScopedNotification>
          ) : (
            <div className="slds-box slds-box_small slds-m-bottom_medium">
              <p className="slds-m-bottom_x-small">
                <strong>{formatNumber(overwrittenCount)}</strong> of {formatNumber(selectedComponents.length)} selected components already
                exist in <strong>{deployTargetOrg.label}</strong> and will be overwritten. Download a deployable backup zip of their current
                target state before deploying.
              </p>
              {backupError && (
                <ScopedNotification theme="error" className="slds-m-bottom_x-small">
                  Backup failed: {backupError}
                </ScopedNotification>
              )}
              {backupCompleted && (
                <ScopedNotification theme="success" className="slds-m-bottom_x-small">
                  Target org backup zip downloaded.
                </ScopedNotification>
              )}
              <Grid verticalAlign="center" className="slds-m-bottom_x-small">
                <button
                  type="button"
                  className="slds-button slds-button_neutral"
                  disabled={backupLoading}
                  onClick={handleDownloadTargetBackup}
                >
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  {backupLoading
                    ? 'Retrieving Target Backup...'
                    : backupCompleted
                      ? 'Download Target Backup Again (.zip)'
                      : `Download Target Backup (${formatNumber(overwrittenCount)} items)`}
                </button>
              </Grid>
              {!backupCompleted && !deployOptions.checkOnly && (
                <Checkbox
                  id="org-alignment-skip-backup-ack"
                  label="I already have a backup or accept deploying without downloading a target backup"
                  checked={acknowledgeWithoutBackup}
                  onChange={setAcknowledgeWithoutBackup}
                />
              )}
            </div>
          )}

          <h3 className="slds-text-heading_small slds-m-bottom_x-small">2. Validation &amp; Deployment Options</h3>
          {hasRunValidation && deployOptions.checkOnly ? (
            <ScopedNotification theme="success" className="slds-m-bottom_x-small">
              <Grid align="spread" verticalAlign="center" wrap>
                <span className="slds-m-right_x-small">Validation complete? Ready to switch to an actual deployment.</span>
                <button type="button" className="slds-button slds-button_neutral" onClick={handleSwitchToActualDeploy}>
                  Switch to Deploy
                </button>
              </Grid>
            </ScopedNotification>
          ) : (
            <ScopedNotification theme="light" className="slds-m-bottom_x-small">
              <strong>Validate Only</strong> is selected by default so you can verify tests and dependencies in {deployTargetOrg.label} with
              zero changes first. Uncheck it when you are ready to deploy.
            </ScopedNotification>
          )}
          <DeployMetadataOptions
            key={optionsResetKey}
            deployOptions={deployOptions}
            hiddenOptions={DISABLED_OPTIONS}
            orgType={getOrgType(deployTargetOrg)}
            onChange={setDeployOptions}
          />
        </GridCol>

        <GridCol size={12} sizeLarge={6} className="slds-p-left_medium">
          <h3 className="slds-text-heading_small slds-m-bottom_x-small">
            Deployment Summary ({formatNumber(selectedComponents.length)} components)
          </h3>
          <div
            className="slds-box slds-box_x-small slds-scrollable_y"
            css={css`
              max-height: 44vh;
            `}
          >
            <ul className="slds-has-dividers_bottom">
              {selectedComponents.map((component) => {
                const willOverwrite = direction === 'A_TO_B' ? Boolean(component.targetItem) : Boolean(component.sourceItem);
                return (
                  <li key={component.key} className="slds-item slds-p-vertical_xx-small">
                    <Grid align="spread" verticalAlign="center">
                      <span>
                        <strong>{component.type}</strong>: {component.fullName}
                      </span>
                      <Badge type={willOverwrite ? 'warning' : 'light'}>{willOverwrite ? 'Overwrite' : 'New'}</Badge>
                    </Grid>
                  </li>
                );
              })}
            </ul>
          </div>
        </GridCol>
      </Grid>
    </Modal>
  );
};

export default OrgAlignmentDeployModal;
