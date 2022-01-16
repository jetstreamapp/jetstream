import { ListItem } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { AutomationMetadataType } from './automation-control-types';

export const priorSelectedOrg = atom<string>({
  key: 'automation-control.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
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
  default: ['ApexTrigger', 'ValidationRule', 'WorkflowRule', 'FlowProcessBuilder', 'FlowRecordTriggered'],
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
