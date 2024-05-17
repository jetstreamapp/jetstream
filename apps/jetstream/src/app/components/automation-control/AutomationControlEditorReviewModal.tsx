import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, Icon, Modal, Spinner } from '@jetstream/ui';
import { ConfirmPageChange, useAmplitude } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { Column } from 'react-data-grid';
import { deployMetadata, getAutomationTypeLabel, preparePayloads } from './automation-control-data-utils';
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
  onClose: (refreshData?: boolean) => void;
}

export const AutomationControlEditorReviewModal: FunctionComponent<AutomationControlEditorReviewModalProps> = ({
  selectedOrg,
  defaultApiVersion,
  rows,
  onClose,
}) => {
  const { trackEvent } = useAmplitude();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [deploymentItemMap, setDeploymentItemMap] = useState<DeploymentItemMap>(() => getDeploymentItemMap(rows));
  const [deploymentItems, setDeploymentItems] = useState<DeploymentItem[]>([]);
  const [modalLabel, setModalLabel] = useState('Review Changes');
  const [nextButtonLabel, setNextButtonLabel] = useState('Continue');
  const [inProgress, setInProgress] = useState(false);
  const [didDeploy, setDidDeploy] = useState(false);
  const [didRollback, setDidRollback] = useState(false);
  const [didDeployMetadata, setDidDeployMetadata] = useState(false);

  const deploymentItemRows: DeploymentItemRow[] = useMemo(
    () =>
      deploymentItems.map(({ status, metadata, deploy }) => ({
        status,
        deploy,
        typeLabel: getAutomationTypeLabel(metadata.type),
        ...metadata,
      })),
    [deploymentItems]
  );

  useEffect(() => {
    setDeploymentItems(Object.values(deploymentItemMap));
  }, [deploymentItemMap]);

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
        // Set all items not already prepared as error since observable is cancelled on error
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
          }, {})
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
          }, {})
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

  function handleDeployMetadata(currDeploymentItemMap: DeploymentItemMap, isRollback?: boolean) {
    trackEvent(ANALYTICS_KEYS.automation_deploy, { type: isRollback ? 'rollback' : 'deploy', items: deploymentItems.length });
    return deployMetadata(defaultApiVersion, selectedOrg, currDeploymentItemMap).subscribe({
      next: (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
        logger.log('handleDeployMetadata - emitted()', items);
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
        // Set all items not already prepared as error since observable is cancelled on error
        setDeploymentItemMap((prevState) => ({
          ...prevState,
          ...Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
            output[key] = { ...deploymentItemMap[key], status: 'Error' };
            return output;
          }, {}),
        }));
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

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={inProgress} />
      <Modal
        size="lg"
        header={modalLabel}
        closeOnBackdropClick={false}
        closeOnEsc={false}
        onClose={() => handleCloseModal()}
        footer={
          <Fragment>
            {!didDeploy && (
              <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={inProgress}>
                Cancel
              </button>
            )}
            {didDeploy && !didRollback && (
              <button
                className="slds-button slds-button_neutral"
                onClick={() => handleRollbackMetadata()}
                title="Revert all successfully deployed items"
                disabled={inProgress}
              >
                <Icon type="utility" icon="undo" className="slds-button__icon slds-button__icon_left" omitContainer />
                Rollback
              </button>
            )}
            <button className="slds-button slds-button_brand" onClick={() => setCurrentStep(currentStep + 1)} disabled={inProgress}>
              {nextButtonLabel}
            </button>
          </Fragment>
        }
      >
        <div
          className="slds-is-relative"
          css={css`
            min-height: 50vh;
          `}
        >
          {inProgress && <Spinner />}
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={250}>
            <DataTable columns={COLUMNS} data={deploymentItemRows} getRowKey={getRowId} />
          </AutoFullHeightContainer>
        </div>
      </Modal>
    </Fragment>
  );
};

export default AutomationControlEditorReviewModal;
