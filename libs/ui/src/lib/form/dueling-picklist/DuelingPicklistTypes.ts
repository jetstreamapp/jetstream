import { UpDown } from '@jetstream/types';

export interface DuelingPicklistItem {
  label: string;
  value: string;
  /** Shown as the tooltip of the option, falls back to the label */
  title?: string;
}

export interface DuelingPicklistColumnRef {
  /** Move the selected options to the other column, used by the arrow buttons */
  moveSelection: () => void;
  moveWithinList: (direction: UpDown) => void;
  /** Select options that were just moved into this column with the keyboard and focus the first one */
  focusItems: (values: string[]) => void;
}
