import { AutomationMetadataType, DescribeGlobalSObjectResult, ListItem } from '@jetstream/types';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export const priorSelectedOrg = atomWithReset<string | null>(null);

export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);

export const selectedSObjectsState = atomWithReset<string[]>([]);

export const automationTypes = atomWithReset<ListItem<AutomationMetadataType>[]>([
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
]);

export const selectedAutomationTypes = atomWithReset<AutomationMetadataType[]>([
  'ApexTrigger',
  'DuplicateRule',
  'ValidationRule',
  'WorkflowRule',
  'FlowRecordTriggered',
]);

export const hasSelectionsMade = atom((get) => {
  if (!get(selectedSObjectsState)?.length) {
    return false;
  }
  if (!get(selectedAutomationTypes)?.length) {
    return false;
  }
  return true;
});
