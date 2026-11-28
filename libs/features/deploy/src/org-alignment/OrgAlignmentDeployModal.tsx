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
  Tooltip,
} from '@jetstream/ui';
import { fromJetstreamEvents, OrgLabelBadge } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, useOperationAccess } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeployMetadataToOrgStatusModal from '../deploy-to-different-org/DeployMetadataToOrgStatusModal';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';
import { DeploymentSummaryList } from '../utils/DeploymentSummaryList';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import { retrieveMetadataChunked } from '../view-or-compare-metadata/retrieveMetadataChunked';
import { PROFILE_METADATA_TYPE } from './orgAlignmentMetadataClassification';
import { OrgAlignmentComponentItem, OrgAlignmentDependencyFinding, OrgAlignmentDeployDirection } from './orgAlignmentTypes';
import { componentsToListMetadataMap, getDeployFromAndTo, getDeployToItem, getOverwrittenTargetComponentsMap } from './orgAlignmentUtils';
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
  const isMounted = useRef(true);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const { from: deploySourceOrg, to: deployTargetOrg } = getDeployFromAndTo(sourceOrg, targetOrg, direction);
  const isTargetProduction = getOrgType(deployTargetOrg) === 'Production';

  const [step, setStep] = useState<'DEPENDENCIES' | 'BACKUP_AND_OPTIONS' | 'DEPLOY'>('DEPENDENCIES');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(initialSelectedComponents.map(({ key }) => key)));
  // Everything offered for review. Unchecked components stay listed so they can be checked again.
  const [reviewKeys, setReviewKeys] = useState<string[]>(() => initialSelectedComponents.map(({ key }) => key));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [backupLoading, setBackupLoading] = useState(false);
  // The overwritten components covered by the downloaded backup or by the acknowledgment, so that
  // selecting more components afterwards requires a new backup or acknowledgment
  const [backedUpKeys, setBackedUpKeys] = useState<Set<string> | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [acknowledgedKeys, setAcknowledgedKeys] = useState<Set<string> | null>(null);

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
  // Only a validation that succeeded: going back from a failed one must not suggest it is safe to deploy
  const [validationSucceeded, setValidationSucceeded] = useState(false);
  const handleValidationSucceeded = useCallback(() => setValidationSucceeded(true), []);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState(false);
  const [deployResultsData, setDeployResultsData] = useState<Record<string, unknown[]>>();

  const {
    componentsByKey: allComponentsByKey,
    selectedComponents,
    loading: dependenciesLoading,
    findings: dependencyFindings,
    toolingApiError,
    recheck: recheckDependencies,
  } = useDependencies({
    deploySourceOrg,
    deployTargetOrg,
    selectedKeys,
    comparedComponents: allComponents,
    targetInventoryByType: destinationInventoryByType,
    direction,
    enabled: step === 'DEPENDENCIES',
  });

  const selectedMetadataMap = useMemo(() => componentsToListMetadataMap(selectedComponents, direction), [direction, selectedComponents]);

  const overwrittenTargetMap = useMemo(
    () => getOverwrittenTargetComponentsMap(selectedComponents, direction),
    [direction, selectedComponents],
  );

  const overwrittenTargetKeys = useMemo(
    () => Object.entries(overwrittenTargetMap).flatMap(([type, items]) => items.map(({ fullName }) => `${type}:${fullName}`)),
    [overwrittenTargetMap],
  );
  const overwrittenCount = overwrittenTargetKeys.length;

  const backupCompleted = !!backedUpKeys && overwrittenTargetKeys.every((key) => backedUpKeys.has(key));
  const acknowledgeWithoutBackup = !!acknowledgedKeys && overwrittenTargetKeys.every((key) => acknowledgedKeys.has(key));

  // A dependency is listed once, along with every selected component that requires it
  const dependencyGroups = useMemo(() => {
    const groupsByDependency = new Map<
      string,
      { finding: OrgAlignmentDependencyFinding; addableComponentKey?: string; requiredBy: string[] }
    >();
    // Findings are ordered by severity, so the first one of a dependency is the most severe
    for (const finding of dependencyFindings) {
      const dependencyKey = `${finding.referencedType}:${finding.referencedName}`;
      const group = groupsByDependency.get(dependencyKey) ?? { finding, requiredBy: [] };
      groupsByDependency.set(dependencyKey, group);
      group.addableComponentKey = group.addableComponentKey ?? finding.addableComponentKey;
      const requiredBy = `${finding.sourceComponentType}: ${finding.sourceComponentName}`;
      if (!group.requiredBy.includes(requiredBy)) {
        group.requiredBy.push(requiredBy);
      }
    }
    return Array.from(groupsByDependency.values());
  }, [dependencyFindings]);

  const missingCount = dependencyGroups.filter(({ finding }) => finding.severity === 'missing').length;
  const differsCount = dependencyGroups.filter(({ finding }) => finding.severity === 'differs').length;
  const externalCount = dependencyGroups.filter(({ finding }) => finding.severity === 'external').length;

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
    // What was validated is no longer what would be deployed
    setValidationSucceeded(false);
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

  function includeComponents(componentKeys: string[]) {
    setValidationSucceeded(false);
    setSelectedKeys((previous) => new Set([...previous, ...componentKeys]));
    setReviewKeys((previous) => Array.from(new Set([...previous, ...componentKeys])));
  }

  function handleIncludeDependency(componentKey: string) {
    includeComponents([componentKey]);
  }

  function handleIncludeAllMissing() {
    includeComponents(addableMissingKeys);
  }

  async function handleDownloadTargetBackup() {
    const keysToBackUp = new Set(overwrittenTargetKeys);
    if (overwrittenCount === 0) {
      setBackedUpKeys(keysToBackUp);
      return;
    }
    setBackupLoading(true);
    setBackupError(null);
    try {
      const { zip } = await retrieveMetadataChunked(deployTargetOrg, overwrittenTargetMap, { isCanceled: () => !isMounted.current });
      const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 5 } });
      // Closing the modal abandons the backup, a file must not be saved after the user has moved on
      if (!isMounted.current) {
        return;
      }
      const filename = `${getFilename(deployTargetOrg, ['org-alignment-backup'])}.zip`;
      saveFile(buffer, filename, MIME_TYPES.ZIP);
      setBackedUpKeys(keysToBackUp);
    } catch (ex) {
      if (isMounted.current) {
        setBackupError(getErrorMessage(ex));
      }
    } finally {
      if (isMounted.current) {
        setBackupLoading(false);
      }
    }
  }

  function handleStartDeploy(overrideCheckOnly?: boolean) {
    const nextCheckOnly = typeof overrideCheckOnly === 'boolean' ? overrideCheckOnly : Boolean(deployOptions.checkOnly);
    if (typeof overrideCheckOnly === 'boolean') {
      setDeployOptions((previous) => ({ ...previous, checkOnly: overrideCheckOnly }));
    }
    // The outcome of an earlier validation says nothing about the one that is starting
    if (nextCheckOnly) {
      setValidationSucceeded(false);
    }
    setDeployRunId((previous) => previous + 1);
    setStep('DEPLOY');
  }

  /** From a successful validation: deploys right away, unless a backup of what will be overwritten is still owed */
  function handleDeployAfterValidation() {
    if (backupSatisfied) {
      handleStartDeploy(false);
      return;
    }
    handleSwitchToActualDeploy();
    setStep('BACKUP_AND_OPTIONS');
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
          afterValidationAction={
            deployAccess.allowed
              ? {
                  label: backupSatisfied ? `Deploy to ${deployTargetOrg.label}` : 'Continue to Deploy',
                  onClick: handleDeployAfterValidation,
                }
              : undefined
          }
          onValidationSucceeded={handleValidationSucceeded}
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

  // Salesforce only includes the parts of a profile that relate to the other components of the same request, so
  // a deployment (and its backup) carries less of a profile than the comparison, which retrieves all of it
  const profileNotice = selectedComponents.some(({ type }) => type === PROFILE_METADATA_TYPE) && (
    <ScopedNotification theme="warning" className="slds-m-bottom_small">
      <strong>Profiles are deployed partially.</strong> Salesforce only deploys a profile's access to objects, fields, Apex classes,
      Visualforce pages, tabs, layouts, record types, apps and flows for the components that are part of this deployment. Other differences
      shown in the comparison are not deployed, and the target backup is limited in the same way. Include the related components to deploy
      their access, and compare again afterwards to confirm the result.
    </ScopedNotification>
  );

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
    const groupedSelection = reviewKeys.reduce<Record<string, OrgAlignmentComponentItem[]>>((acc, key) => {
      const item = allComponentsByKey.get(key);
      if (item) {
        acc[item.typeLabel] = acc[item.typeLabel] || [];
        acc[item.typeLabel].push(item);
      }
      return acc;
    }, {});

    return (
      <Modal
        header="Review Components and Dependencies (Step 1 of 2)"
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
              <button type="button" className="slds-button slds-button_neutral slds-m-right_x-small" onClick={onClose}>
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
        {profileNotice}
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
                    const willOverwrite = Boolean(getDeployToItem(item, direction));
                    return (
                      <div key={item.key} className="slds-p-vertical_xxx-small">
                        <Checkbox
                          id={`align-deploy-select-${item.key}`}
                          checked={selectedKeys.has(item.key)}
                          onChange={(checked) => toggleSelectedKey(item.key, checked)}
                          label={
                            <span>
                              <span>{item.fullName}</span>
                              <Tooltip
                                id={`align-deploy-impact-${item.key}`}
                                content={
                                  willOverwrite
                                    ? `Already exists in ${deployTargetOrg.label}. Deploying replaces it with the version from ${deploySourceOrg.label}. You can download a backup on the next step.`
                                    : `Does not exist in ${deployTargetOrg.label} and will be created.`
                                }
                              >
                                <Badge type={willOverwrite ? 'warning' : 'light'} className="slds-m-left_x-small">
                                  {willOverwrite ? 'Overwrite' : 'New'}
                                </Badge>
                              </Tooltip>
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
              Salesforce cannot identify every dependency, so this check may miss some and may flag others that are not required. Validate
              the deployment first to be sure.
            </ScopedNotification>

            {toolingApiError && (
              <ScopedNotification theme="warning" className="slds-m-bottom_small">
                Salesforce could not be asked about dependencies ({toolingApiError}). The results below only cover parent objects and
                folders.
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
                    {externalCount > 0 && <Badge type="light">{formatNumber(externalCount)} could not be checked</Badge>}
                  </div>
                  <ul className="slds-has-dividers_bottom-space">
                    {dependencyGroups.map(({ finding, addableComponentKey, requiredBy }) => (
                      <li key={`${finding.referencedType}:${finding.referencedName}`} className="slds-item slds-p-vertical_x-small">
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
                                    : finding.referencedNamespace
                                      ? 'Managed Package'
                                      : 'Not Checked'}
                              </Badge>
                              <strong>
                                {finding.referencedType}: {finding.referencedName}
                              </strong>
                            </div>
                            <div className="slds-text-body_small slds-text-color_weak slds-m-top_xxx-small">{finding.message}</div>
                            <div className="slds-text-body_small slds-text-color_weak slds-m-top_xxx-small">
                              Required by:
                              <ul className="slds-list_dotted">
                                {requiredBy.map((requiredByLabel) => (
                                  <li key={requiredByLabel}>{requiredByLabel}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {addableComponentKey && !selectedKeys.has(addableComponentKey) && (
                            <button
                              type="button"
                              className="slds-button slds-button_neutral"
                              onClick={() => handleIncludeDependency(addableComponentKey)}
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
            <button type="button" className="slds-button slds-button_neutral slds-m-right_x-small" onClick={onClose}>
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
          <strong>Production target org:</strong> {deployTargetOrg.label} is a Production org. Validate Only is enabled by default. Download
          a target backup and run validation before deploying.
        </ScopedNotification>
      )}
      {profileNotice}

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
                  onChange={(checked) => setAcknowledgedKeys(checked ? new Set(overwrittenTargetKeys) : null)}
                />
              )}
            </div>
          )}

          <h3 className="slds-text-heading_small slds-m-bottom_x-small">2. Validation &amp; Deployment Options</h3>
          {validationSucceeded && deployOptions.checkOnly ? (
            <ScopedNotification theme="success" className="slds-m-bottom_x-small">
              <Grid align="spread" verticalAlign="center" wrap>
                <span className="slds-m-right_x-small">Validation succeeded. Ready to switch to an actual deployment?</span>
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
          <DeploymentSummaryList
            heading="Deployment Summary"
            maxHeight="44vh"
            items={selectedComponents.map((component) => {
              const willOverwrite = Boolean(getDeployToItem(component, direction));
              return {
                type: component.type,
                fullName: component.fullName,
                trailingContent: <Badge type={willOverwrite ? 'warning' : 'light'}>{willOverwrite ? 'Overwrite' : 'New'}</Badge>,
              };
            })}
          />
        </GridCol>
      </Grid>
    </Modal>
  );
};

export default OrgAlignmentDeployModal;
