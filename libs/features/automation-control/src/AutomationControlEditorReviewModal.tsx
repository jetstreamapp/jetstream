import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { AutomationControlHistorySource, AutomationControlRestoreAction, SalesforceOrgUi } from '@jetstream/types';
import type { Column } from '@jetstream/ui';
import {
  ariaDisabledButtonProps,
  AssistiveStatus,
  AutoFullHeightContainer,
  DataTable,
  DisabledReasonButton,
  Grid,
  Icon,
  Modal,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { ConfirmPageChange, useAnalytics } from '@jetstream/ui-core';
import { useOperationAccess } from '@jetstream/ui/app-state';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { from, switchMap } from 'rxjs';
import { deployMetadata, getAutomationTypeLabel, preparePayloads } from './automation-control-data-utils';
import { createHistoryRecorder } from './automation-control-history-utils';
import { getPackageItemsFromRows } from './automation-control-package-utils';
import { AutomationDeployStatusRenderer, BooleanAndVersionRenderer } from './automation-control-table-renderers';
import {
  AutomationControlDeploymentItem,
  AutomationMetadataType,
  DeploymentItem,
  DeploymentItemMap,
  DeploymentItemRow,
  FlowViewRecord,
  TableRowItem,
} from './automation-control-types';
import { AutomationPackageDownloadModal, AutomationPackageDropDown } from './AutomationControlPackageDownload';
import { useAutomationPackageDownload } from './useAutomationPackageDownload';

const REQUIRE_METADATA_API = new Set<AutomationMetadataType>(['ApexTrigger', 'DuplicateRule']);

const COLUMNS: Column<DeploymentItemRow>[] = [
  {
    name: 'Object',
    key: 'sobject',
    width: 200,
  },
  {
    name: 'Type',
    key: 'typeLabel',
    width: 200,
  },
  {
    name: 'Name',
    key: 'label',
    width: 350,
  },
  {
    name: 'Old Value',
    key: 'isActiveInitialState',
    renderCell: BooleanAndVersionRenderer,
    width: 130,
    cellClass: 'bg-color-gray',
  },
  {
    name: 'New Value',
    key: 'isActive',
    renderCell: BooleanAndVersionRenderer,
    width: 130,
    cellClass: 'active-item-yellow-bg',
  },
  {
    name: 'Status',
    key: 'status',
    renderCell: AutomationDeployStatusRenderer,
    width: 200,
  },
];

function getDeploymentItemMap(rows: TableRowItem[]): DeploymentItemMap {
  return rows.reduce((output: DeploymentItemMap, row) => {
    output[row.key] = {
      status: 'Not Started',
      metadata: row,
      deploy: {
        type: row.type,
        id:
          row.type === 'FlowProcessBuilder' || row.type === 'FlowRecordTriggered'
            ? (row.record as FlowViewRecord).DurableId
            : row.record.Id,
        activeVersionNumber: row.activeVersionNumber,
        value: row.isActive,
        requireMetadataApi: REQUIRE_METADATA_API.has(row.type),
        metadataRetrieve: null,
        metadataDeploy: null,
        retrieveError: null,
        deployError: null,
      },
    };
    return output;
  }, {});
}

const getRowId = (item: DeploymentItemRow) => item.key;

export interface AutomationControlEditorReviewModalProps {
  defaultApiVersion: string;
  selectedOrg: SalesforceOrgUi;
  rows: TableRowItem[];
  /** Set when these changes were staged from history, so the deployment is recorded as that rollback/re-deploy */
  historyRestore?: { action: AutomationControlRestoreAction; source: AutomationControlHistorySource } | null;
  onClose: (refreshData?: boolean) => void;
}

export const AutomationControlEditorReviewModal: FunctionComponent<AutomationControlEditorReviewModalProps> = ({
  selectedOrg,
  defaultApiVersion,
  rows,
  historyRestore,
  onClose,
}) => {
  const { trackEvent } = useAnalytics();
  /** History entry of this modal's deploy, referenced by the rollback entry if Rollback is clicked */
  const deployHistorySource = useRef<AutomationControlHistorySource | null>(null);
  const { preparingVariant, packageDownload, packageError, preparePackage, closePackageDownload, packageTriggerRef, modalInitialFocus } =
    useAutomationPackageDownload(selectedOrg, defaultApiVersion, 'review');
  const deployAccess = useOperationAccess('metadata.deploy');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [deploymentItemMap, setDeploymentItemMap] = useState<DeploymentItemMap>(() => getDeploymentItemMap(rows));
  const [deploymentItems, setDeploymentItems] = useState<DeploymentItem[]>([]);
  const [modalLabel, setModalLabel] = useState('Review Changes');
  const [nextButtonLabel, setNextButtonLabel] = useState('Continue');
  const [inProgress, setInProgress] = useState(false);
  const [didDeploy, setDidDeploy] = useState(false);
  const [didRollback, setDidRollback] = useState(false);
  const [didDeployMetadata, setDidDeployMetadata] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const deploymentItemRows: DeploymentItemRow[] = useMemo(
    () =>
      deploymentItems.map(({ status, metadata, deploy }) => ({
        status,
        deploy,
        typeLabel: getAutomationTypeLabel(metadata.type),
        ...metadata,
      })),
    [deploymentItems],
  );

  useEffect(() => {
    setDeploymentItems(Object.values(deploymentItemMap));
  }, [deploymentItemMap]);

  // Mirrors what sighted users see (spinner, per-row status column, modal header) for each phase:
  // initial metadata retrieval, deploy/rollback progress, and the final outcome with counts
  const assistiveMessage = useMemo(() => {
    if (inProgress) {
      return currentStep === 0 ? 'Loading current automation metadata for review' : modalLabel;
    }
    const errorCount = deploymentItems.filter(({ status }) => status === 'Error').length;
    if (didDeploy) {
      const successCount = deploymentItems.filter(({ status }) => status === 'Deployed' || status === 'Rolled Back').length;
      return `${modalLabel}. ${successCount} succeeded, ${errorCount} failed.`;
    }
    return `Ready to review. ${deploymentItems.length} changes loaded${errorCount ? `, ${errorCount} with errors` : ''}.`;
  }, [inProgress, currentStep, modalLabel, deploymentItems, didDeploy]);

  const handlePreparePayloads = useCallback(() => {
    return preparePayloads(defaultApiVersion, selectedOrg, deploymentItemMap).subscribe({
      next: (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
        logger.log('preparePayloads - emitted()', items);
        const tempDeploymentItemMap = items.reduce((output: DeploymentItemMap, item) => {
          output[item.key] = {
            ...deploymentItemMap[item.key],
            status: item.deploymentItem.retrieveError ? 'Error' : 'Ready for Deploy',
            deploy: item.deploymentItem,
          };
          return output;
        }, {});
        // use callback notation to ensure that we have the correct previous state variable
        setDeploymentItemMap((prevState) => ({ ...prevState, ...tempDeploymentItemMap }));
      },
      error: (err) => {
        logger.warn('preparePayloads - error()', err);
        // Set all items not already prepared as error since observable is canceled on error
        setDeploymentItemMap((prevState) => ({
          ...prevState,
          ...Object.keys(deploymentItemMap)
            .filter((key) => deploymentItemMap[key].status === 'Preparing')
            .reduce((output: DeploymentItemMap, key) => {
              output[key] = { ...deploymentItemMap[key], status: 'Error' };
              return output;
            }, {}),
        }));
        setInProgress(false);
      },
      complete: () => {
        logger.log('preparePayloads - complete()');
        setInProgress(false);
      },
    });
  }, [defaultApiVersion, deploymentItemMap, selectedOrg]);

  useEffect(() => {
    switch (currentStep) {
      case 0: {
        setModalLabel('Review Changes');
        setNextButtonLabel('Deploy Changes');
        setInProgress(true);

        setDeploymentItemMap(
          Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
            output[key] = { ...deploymentItemMap[key], status: 'Preparing' };
            return output;
          }, {}),
        );
        const subscription = handlePreparePayloads();
        return () => {
          subscription.unsubscribe();
        };
      }
      case 1: {
        setModalLabel('Deploying Changes');
        setInProgress(true);

        setDeploymentItemMap(
          Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
            output[key] = { ...deploymentItemMap[key], status: 'Deploying' };
            return output;
          }, {}),
        );
        const subscription = handleDeployMetadata(deploymentItemMap);
        return () => {
          subscription.unsubscribe();
        };
      }
      case 2: {
        handleCloseModal();
        break;
      }
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /**
   * Starts recording this deploy in history, see {@link createHistoryRecorder}.
   *
   * @returns saves the entry with the results so far, or null when there is nothing to record
   */
  function startHistoryRecording(submittedItemMap: DeploymentItemMap, isRollback: boolean) {
    const submittedItems = Object.values(submittedItemMap);
    // a rollback after a fully failed deploy has nothing to submit
    if (submittedItems.length === 0) {
      return null;
    }
    const { key, createdAt, save } = createHistoryRecorder({
      org: selectedOrg.uniqueId,
      action: isRollback ? 'rollback' : historyRestore?.action || 'deploy',
      source: isRollback ? deployHistorySource.current : historyRestore?.source || null,
      isRollback,
      submittedItems,
    });
    if (!isRollback) {
      deployHistorySource.current = { key, createdAt };
    }
    return save;
  }

  /** Cancel stays focusable while deploying and unmounts once the deploy finishes, so focus moves to the primary button */
  function moveFocusOffCancel() {
    if (cancelButtonRef.current && document.activeElement === cancelButtonRef.current) {
      primaryButtonRef.current?.focus();
    }
  }

  function handleDeployMetadata(currDeploymentItemMap: DeploymentItemMap, isRollback?: boolean) {
    trackEvent(ANALYTICS_KEYS.automation_deploy, { type: isRollback ? 'rollback' : 'deploy', items: deploymentItems.length });
    const deployResultsByKey: Record<string, AutomationControlDeploymentItem> = {};
    const saveHistory = startHistoryRecording(currDeploymentItemMap, !!isRollback);
    // the entry must be committed before anything changes in Salesforce so an interrupted deploy is still recorded
    return from(saveHistory?.() ?? Promise.resolve())
      .pipe(switchMap(() => deployMetadata(defaultApiVersion, selectedOrg, currDeploymentItemMap)))
      .subscribe({
        next: (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
          logger.log('handleDeployMetadata - emitted()', items);
          items.forEach(({ key, deploymentItem }) => {
            deployResultsByKey[key] = deploymentItem;
          });
          saveHistory?.(deployResultsByKey);
          const tempDeploymentItemMap = items.reduce((output: DeploymentItemMap, item) => {
            const successStatus = isRollback ? 'Rolled Back' : 'Deployed';
            output[item.key] = {
              ...deploymentItemMap[item.key],
              status: item.deploymentItem.deployError ? 'Error' : successStatus,
              deploy: item.deploymentItem,
            };
            return output;
          }, {});
          // use callback notation to ensure that we have the correct previous state variable
          setDeploymentItemMap((prevState) => ({ ...prevState, ...tempDeploymentItemMap }));
        },
        error: (err) => {
          logger.warn('handleDeployMetadata - error()', err);
          // Set all items not already prepared as error since observable is canceled on error
          setDeploymentItemMap((prevState) => ({
            ...prevState,
            ...Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
              output[key] = { ...deploymentItemMap[key], status: 'Error' };
              return output;
            }, {}),
          }));
          moveFocusOffCancel();
          setInProgress(false);
          setNextButtonLabel('Close');
          setDidDeploy(true);
          if (isRollback) {
            setModalLabel('Rollback Complete');
            setDidRollback(true);
          } else {
            setModalLabel('Deploy Complete');
          }
        },
        complete: () => {
          logger.log('handleDeployMetadata - complete()');
          moveFocusOffCancel();
          setInProgress(false);
          setDidDeployMetadata(true);
          setNextButtonLabel('Close');
          setDidDeploy(true);
          if (isRollback) {
            setModalLabel('Rollback Complete');
            setDidRollback(true);
          } else {
            setModalLabel('Deploy Complete');
          }
        },
      });
  }

  function handleRollbackMetadata() {
    setModalLabel('Rolling back Changes');
    setInProgress(true);
    // clone items to rollback and replace metadataDeploy with metadataDeployRollback
    const itemsToRollback = Object.keys(deploymentItemMap)
      .filter((key) => deploymentItemMap[key].status === 'Deployed')
      .reduce((output: DeploymentItemMap, key) => {
        output[key] = {
          ...deploymentItemMap[key],
          status: 'Rolling Back',
          deploy: {
            ...deploymentItemMap[key].deploy,
            metadataDeploy: deploymentItemMap[key].deploy.metadataDeployRollback,
          },
        };
        return output;
      }, {});

    setDeploymentItemMap((prevState) => ({
      ...prevState,
      ...itemsToRollback,
    }));

    handleDeployMetadata(itemsToRollback, true);
  }

  function handleCloseModal() {
    if (!inProgress) {
      onClose(didDeployMetadata);
    }
  }

  // Only the first step deploys, so the deploy permission gates just that step
  const nextButtonDisabled = inProgress || (currentStep === 0 && !deployAccess.allowed);

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={inProgress} />
      <Modal
        size="lg"
        header={modalLabel}
        tagline="Each row shows the current (old) and pending (new) active state. Deploying applies the new values to the selected org, and successful changes can be rolled back afterwards."
        closeOnBackdropClick={false}
        closeOnEsc={false}
        hide={!!packageDownload}
        initialFocus={modalInitialFocus}
        onClose={() => handleCloseModal()}
        footer={
          <Grid align="spread" verticalAlign="center">
            <AutomationPackageDropDown
              disabled={inProgress}
              isPreparing={!!preparingVariant}
              triggerRef={packageTriggerRef}
              onSelected={(variant) => preparePackage(getPackageItemsFromRows(rows, variant), variant)}
            />
            <div>
              {/* The footer buttons stay focusable while a deploy is in flight, so focus is not dropped mid-operation */}
              {!didDeploy && (
                <button
                  ref={cancelButtonRef}
                  className="slds-button slds-button_neutral"
                  {...ariaDisabledButtonProps(inProgress, () => onClose())}
                >
                  Cancel
                </button>
              )}
              {didDeploy && !didRollback && (
                <DisabledReasonButton
                  className="slds-button slds-button_neutral"
                  tooltip={inProgress ? undefined : 'Revert all successfully deployed items'}
                  disabled={inProgress || !deployAccess.allowed}
                  disabledReason={deployAccess.deniedReason}
                  onClick={() => {
                    handleRollbackMetadata();
                    // This button unmounts when the rollback finishes — hand focus to the primary
                    // button (which becomes "Close") so focus survives the removal
                    primaryButtonRef.current?.focus();
                  }}
                >
                  <Icon type="utility" icon="undo" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Rollback
                </DisabledReasonButton>
              )}
              {/* The first step's next button deploys, later steps only close the modal */}
              <DisabledReasonButton
                ref={primaryButtonRef}
                className="slds-button slds-button_brand"
                // the tooltip wrapper breaks SLDS's adjacent-button spacing
                tooltipClassName="slds-m-left_xx-small"
                disabled={nextButtonDisabled}
                disabledReason={currentStep === 0 ? deployAccess.deniedReason : undefined}
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                {nextButtonLabel}
              </DisabledReasonButton>
            </div>
          </Grid>
        }
      >
        {packageError && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small" allowClose dismissResetKey={packageError}>
            {packageError}
          </ScopedNotification>
        )}
        <div
          className="slds-is-relative"
          css={css`
            min-height: 50vh;
          `}
        >
          <AssistiveStatus debounceMs={500} message={assistiveMessage} />
          {inProgress && <Spinner />}
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={250}>
            <DataTable columns={COLUMNS} data={deploymentItemRows} getRowKey={getRowId} />
          </AutoFullHeightContainer>
        </div>
      </Modal>
      {packageDownload && (
        <AutomationPackageDownloadModal
          selectedOrg={selectedOrg}
          packageDownload={packageDownload}
          source="automation_control_review"
          onClose={closePackageDownload}
        />
      )}
    </Fragment>
  );
};

export default AutomationControlEditorReviewModal;
