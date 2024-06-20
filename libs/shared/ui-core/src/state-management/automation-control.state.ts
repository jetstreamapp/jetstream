import { AutomationMetadataType, DescribeGlobalSObjectResult, ListItem } from '@jetstream/types';
import { atom, selector } from 'recoil';

export const priorSelectedOrg = atom<string | null>({
  key: 'automation-control.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'automation-control.sObjectsState',
  default: null,
});

export const selectedSObjectsState = atom<string[]>({
  key: 'automation-control.selectedSObjectsState',
  default: [],
});

export const automationTypes = atom<ListItem<AutomationMetadataType>[]>({
  key: 'automation-control.automationTypes',
  default: [
    { id: 'ApexTrigger', value: 'ApexTrigger', label: 'Apex Triggers', title: 'Apex Triggers' },
    { id: 'DuplicateRule', value: 'DuplicateRule', label: 'Duplicate Rules', title: 'Duplicate Rules' },
    { id: 'ValidationRule', value: 'ValidationRule', label: 'Validation Rules', title: 'Validation Rules' },
    { id: 'WorkflowRule', value: 'WorkflowRule', label: 'Workflow Rules', title: 'Workflow Rules' },
    { id: 'FlowRecordTriggered', value: 'FlowRecordTriggered', label: 'Record Triggered Flows', title: 'Record Triggered Flows' },
    {
      id: 'FlowProcessBuilder',
      value: 'FlowProcessBuilder',
      label: 'Process Builders',
      title: 'Process Builders',
      secondaryLabel: 'Process Builders require additional loading time',
    },
  ],
});

export const selectedAutomationTypes = atom<AutomationMetadataType[]>({
  key: 'automation-control.selectedAutomationTypes',
  default: ['ApexTrigger', 'DuplicateRule', 'ValidationRule', 'WorkflowRule', 'FlowRecordTriggered'],
});

export const hasSelectionsMade = selector({
  key: 'automation-control.hasSelectionsMade',
  get: ({ get }) => {
    if (!get(selectedSObjectsState)?.length) {
      return false;
    }
    if (!get(selectedAutomationTypes)?.length) {
      return false;
    }
    return true;
  },
});
