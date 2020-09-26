/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Modal, ProgressIndicator } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { logger } from '@jetstream/shared/client-logger';
import { AutomationControlDeploymentItem, AutomationItemsChildren, DeploymentItemMap } from '../automation-control-types';
import { deployMetadata, preparePayloads } from '../utils/automation-control-data-utils';
import AutomationControlPreDeploymentTable from './PreDeploymentTable';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlDeployModalProps {
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

export const AutomationControlDeployModal: FunctionComponent<AutomationControlDeployModalProps> = ({ selectedOrg, itemsById, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [deploymentItemMap, setDeploymentItemMap] = useState<DeploymentItemMap>(getDeploymentItemMap(itemsById));
  const [modalLabel, setModalLabel] = useState('Review Changes');
  const [nextButtonLabel, setNextButtonLabel] = useState('Continue');
  const [inProgress, setInProgress] = useState(false);
  const [didDeployMetadata, setDidDeployMetadata] = useState(false);

  useEffect(() => {
    switch (currentStep) {
      case 0:
        setModalLabel('Review Changes');
        setNextButtonLabel('Continue');
        break;
      case 1: {
        setModalLabel('Preparing Changes');
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
      case 2: {
        setModalLabel('Deploying Changes');
        setInProgress(true);

        setDeploymentItemMap(
          Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
            output[key] = { ...deploymentItemMap[key], status: 'Deploying' };
            return output;
          }, {})
        );
        const subscription = handleDeployMetadata();
        return () => {
          subscription.unsubscribe();
        };
      }
      default:
        break;
    }
  }, [currentStep]);

  function buttonsDisabled() {
    return inProgress || currentStep >= 2;
  }

  function handleCloseModal() {
    if (!inProgress) {
      onClose(didDeployMetadata);
    }
  }

  function handlePreparePayloads() {
    return preparePayloads(selectedOrg, deploymentItemMap).subscribe(
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
        setInProgress(false);
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
      },
      () => {
        logger.log('preparePayloads - complete()');
        setInProgress(false);
      }
    );
  }

  function handleDeployMetadata() {
    return deployMetadata(selectedOrg, deploymentItemMap).subscribe(
      (items: { key: string; deploymentItem: AutomationControlDeploymentItem }[]) => {
        logger.log('handleDeployMetadata - emitted()', items);
        const tempDeploymentItemMap = items.reduce((output: DeploymentItemMap, item) => {
          output[item.key] = {
            ...deploymentItemMap[item.key],
            status: item.deploymentItem.deployError ? 'Error' : 'Success',
            deploy: item.deploymentItem,
          };
          return output;
        }, {});
        // use callback notation to ensure that we have the correct previous state variable
        setDeploymentItemMap((prevState) => ({ ...prevState, ...tempDeploymentItemMap }));
      },
      (err) => {
        logger.warn('handleDeployMetadata - error()', err);
        setInProgress(false);
        // Set all items not already prepared as error since observable is cancelled on error
        setDeploymentItemMap((prevState) => ({
          ...prevState,
          ...Object.keys(deploymentItemMap).reduce((output: DeploymentItemMap, key) => {
            output[key] = { ...deploymentItemMap[key], status: 'Error' };
            return output;
          }, {}),
        }));
      },
      () => {
        logger.log('handleDeployMetadata - complete()');
        setInProgress(false);
        setDidDeployMetadata(true);
      }
    );
  }

  return (
    <Modal
      header={modalLabel}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={buttonsDisabled()}>
            Cancel
          </button>
          <ProgressIndicator className="slds-progress_shade" totalSteps={3} currentStep={currentStep} readOnly></ProgressIndicator>
          <button className="slds-button slds-button_brand" onClick={() => setCurrentStep(currentStep + 1)} disabled={buttonsDisabled()}>
            {nextButtonLabel}
          </button>
        </Fragment>
      }
      footerClassName="slds-grid slds-grid_align-spread"
      size="lg"
      onClose={handleCloseModal}
    >
      <div>
        <AutomationControlPreDeploymentTable itemsById={itemsById} deploymentItemMap={deploymentItemMap} />
      </div>
    </Modal>
  );
};

export default AutomationControlDeployModal;
