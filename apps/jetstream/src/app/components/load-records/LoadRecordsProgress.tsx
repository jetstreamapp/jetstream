/** @jsx jsx */
import { jsx } from '@emotion/core';
import { InsertUpdateUpsertDelete } from '@jetstream/types';
import { ProgressIndicatorListItem, ProgressIndicator } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

export interface LoadRecordsProgressProps {
  currentStep: number;
  hasFileData: boolean;
  hasSelectedObject: boolean;
  loadType: InsertUpdateUpsertDelete;
  hasExternalId: boolean;
}

export const LoadRecordsProgress: FunctionComponent<LoadRecordsProgressProps> = ({
  currentStep,
  hasFileData,
  hasSelectedObject,
  loadType,
  hasExternalId,
}) => {
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [nextStepDisabled, setNextStepDisabled] = useState<boolean>(true);

  useEffect(() => {
    let currStepButtonText = '';
    let isNextStepDisabled = true;
    switch (currentStep) {
      case 0:
        currStepButtonText = 'Continue to Map Fields';
        isNextStepDisabled = !hasSelectedObject || !hasFileData || !loadType || (loadType === 'UPSERT' && !hasExternalId);
        break;
      case 1:
        // TODO: Allow skipping this step
        currStepButtonText = 'Continue to Disable Automation';
        break;
      case 2:
        currStepButtonText = 'Continue to Load Records Automation';
        break;
      case 3:
        // TODO: Only show this if automation was disabled
        currStepButtonText = 'Continue to Revert Automation';
        break;
      default:
        currStepButtonText = currentStepText;
        isNextStepDisabled = nextStepDisabled;
        break;
    }
    setCurrentStepText(currStepButtonText);
    setNextStepDisabled(isNextStepDisabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, hasSelectedObject, hasFileData, loadType, hasExternalId]);

  return (
    <ProgressIndicator currentStep={currentStep} isVertical>
      <ProgressIndicatorListItem
        step={0}
        stepText="Choose Object and Load File"
        isVertical
        isActive={currentStep === 0}
        isComplete={currentStep > 0}
      />
      <ProgressIndicatorListItem step={1} stepText="Map Fields" isVertical isActive={currentStep === 1} isComplete={currentStep > 1} />
      <ProgressIndicatorListItem
        step={2}
        stepText="Disable Automation (optional)"
        isVertical
        isActive={currentStep === 2}
        isComplete={currentStep > 2}
      />
      <ProgressIndicatorListItem step={3} stepText="Load Data" isVertical isActive={currentStep === 3} isComplete={currentStep > 3} />
      <ProgressIndicatorListItem
        step={4}
        stepText="Rollback Automation (optional)"
        isVertical
        isActive={currentStep === 4}
        isComplete={currentStep > 4}
      />
    </ProgressIndicator>
  );
};

export default LoadRecordsProgress;
