/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Icon, Modal } from '@jetstream/ui';
import ConfirmPageChange from '../../core/ConfirmPageChange';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { AutomationControlDeploymentItem, AutomationItemsChildren, DeploymentItemMap } from '../automation-control-types';
import { deployMetadata, preparePayloads } from '../utils/automation-control-data-utils';
import AutomationControlPreDeploymentTable from './PreDeploymentTable';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlDeployModalProps {
  apiVersion: string;
  selectedOrg: SalesforceOrgUi;
  itemsById: MapOf<AutomationItemsChildren>;
  onClose: (refreshData?: boolean) => void;
}

function getDeploymentItemMap(itemsById: MapOf<AutomationItemsChildren>) {
  return (): DeploymentItemMap => {
    return Object.values(itemsById).reduce((output: DeploymentItemMap, currItem) => {
      currItem.automationItems.ApexTrigger.forEach((item) => {
        output[`${currItem.key}|ApexTrigger|${item.fullName}`] = {
          status: 'Not Started',
          metadata: item,
          deploy: {
            type: 'ApexTrigger',
            id: item.metadata.Id,
            activeVersion: null,
            value: item.currentValue,
            requireMetadataApi: true,
            metadataRetrieve: null,
            metadataDeploy: null,
            retrieveError: null,
            deployError: null,
          },
        };
      });
      currItem.automationItems.Flow.forEach((item) => {
        output[`${currItem.key}|Flow|${item.fullName}`] = {
          status: 'Not Started',
          metadata: item,
          deploy: {
            type: 'FlowDefinition',
            id: item.metadata.Id,
            activeVersion: item.currentActiveVersion || null,
            value: item.currentValue,
            requireMetadataApi: false,
            metadataRetrieve: null,
            metadataDeploy: null,
            retrieveError: null,
            deployError: null,
          },
        };
      });
      currItem.automationItems.ValidationRule.forEach((item) => {
        output[`${currItem.key}|ValidationRule|${item.fullName}`] = {
          status: 'Not Started',
          metadata: item,
          deploy: {
            type: 'ValidationRule',
            id: item.metadata.Id,
            activeVersion: null,
            value: item.currentValue,
            requireMetadataApi: false,
            metadataRetrieve: null,
            metadataDeploy: null,
            retrieveError: null,
            deployError: null,
          },
        };
      });
      currItem.automationItems.WorkflowRule.forEach((item) => {
        output[`${currItem.key}|WorkflowRule|${item.fullName}`] = {
          status: 'Not Started',
          metadata: item,
          deploy: {
            type: 'WorkflowRule',
            id: item.metadata.Id,
            activeVersion: null,
            value: item.currentValue,
            requireMetadataApi: false,
            metadataRetrieve: null,
            metadataDeploy: null,
            retrieveError: null,
            deployError: null,
          },
        };
      });
      return output;
    }, {});
  };
}

export const AutomationControlDeployModal: FunctionComponent<AutomationControlDeployModalProps> = ({
  apiVersion,
  selectedOrg,
  itemsById,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [deploymentItemMap, setDeploymentItemMap] = useState<DeploymentItemMap>(getDeploymentItemMap(itemsById));
  const [modalLabel, setModalLabel] = useState('Review Changes');
  const [nextButtonLabel, setNextButtonLabel] = useState('Continue');
  const [inProgress, setInProgress] = useState(false);
  const [didDeploy, setDidDeploy] = useState(false);
  const [didRollback, setDidRollback] = useState(false);
  const [didDeployMetadata, setDidDeployMetadata] = useState(false);

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
  }, [currentStep]);

  function handleCloseModal() {
    if (!inProgress) {
      onClose(didDeployMetadata);
    }
  }

  function handlePreparePayloads() {
    return preparePayloads(apiVersion, selectedOrg, deploymentItemMap).subscribe(
      (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
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
      (err) => {
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
      () => {
        logger.log('preparePayloads - complete()');
        setInProgress(false);
      }
    );
  }

  /**
   *
   * @param currDeploymentItemMap use to allow an object to passed in prior to it being committed to state (used for rollback)
   * @param isRollback if true, will set didRollback property
   */
  function handleDeployMetadata(currDeploymentItemMap: DeploymentItemMap, isRollback?: boolean) {
    return deployMetadata(apiVersion, selectedOrg, currDeploymentItemMap).subscribe(
      (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
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
      (err) => {
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
      () => {
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
      }
    );
  }

  /**
   * Set as deploying and copy metadataDeployRollback to metadataDeploy
   * then pass to regular deploy function
   */
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

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={inProgress} />
      <Modal
        header={modalLabel}
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
        size="lg"
        onClose={handleCloseModal}
      >
        <div>
          <AutomationControlPreDeploymentTable itemsById={itemsById} deploymentItemMap={deploymentItemMap} />
        </div>
      </Modal>
    </Fragment>
  );
};

export default AutomationControlDeployModal;
