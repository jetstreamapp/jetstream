import { UpDown } from '@jetstream/types';

export interface DuelingPicklistItem {
  label: string;
  value: any;
  meta?: any;
}

export interface DuelingPicklistColumnRef {
  clearSelection: () => void;
  toggleSelection: () => void;
  moveWithinList: (direction: UpDown) => void;
}
