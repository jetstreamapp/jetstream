import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem } from '@jetstream/types';
import { addMinutes } from 'date-fns/addMinutes';
import { formatDate } from 'date-fns/format';
import { isSameDay } from 'date-fns/isSameDay';
import { parse as parseDate } from 'date-fns/parse';
import { FunctionComponent, useState } from 'react';
import Picklist, { PicklistProps } from '../picklist/Picklist';

type PicklistPropsWithoutItems = Omit<
  PicklistProps,
  'items' | 'groups' | 'selectedItems' | 'selectedItemIds' | 'multiSelection' | 'omitMultiSelectPills' | 'onChange'
>;

// cache to improve costly re-calculations
const GENERATED_TIME = new Map<number, ListItem[]>();

// attribution: https://github.com/salesforce/design-system-react/blob/master/components/time-picker/index.jsx
function generateTimeListItems(stepInMinutes: number): ListItem[] {
  if (GENERATED_TIME.has(stepInMinutes)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return GENERATED_TIME.get(stepInMinutes)!;
  }
  const output: ListItem[] = [];
  const baseDate = parseDate('00', 'HH', new Date());
  let currDate = new Date(baseDate);
  while (isSameDay(baseDate, currDate)) {
    const label = formatDate(currDate, 'p');
    const value = formatDate(currDate, 'HH:mm:ss.SSS');
    output.push({
      id: value,
      label,
      value,
    });
    currDate = addMinutes(currDate, stepInMinutes);
  }
  GENERATED_TIME.set(stepInMinutes, output);
  return output;
}

/**
 * Ensure initial time is a valid minute/seconds based on stepInMinutes
 * Seconds are stripped and minutes are rounded to stepInMinutes
 *
 * stepInMinutes=15
 * 20:18:38.000 --> 20:15:00.000
 * 20:59:38.000 --> 21:00:00.000
 *
 * @param time
 * @param stepInMinutes
 * @returns
 */
function normalizeInitialTime(time: string, stepInMinutes: number) {
  try {
    // eslint-disable-next-line prefer-const
    let [hour, min] = time.split(':').map((item) => Number(item));
    const remainder = min % stepInMinutes;
    if (remainder !== 0) {
      if (remainder < stepInMinutes / 2) {
        min = min - remainder;
        if (min < 0) {
          min = 0;
        }
      } else {
        min = min + remainder;
        if (min > 60) {
          min = 0;
          hour++;
        }
      }
    }

    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000`;
  } catch (ex) {
    return time;
  }
}

export interface TimePickerProps extends PicklistPropsWithoutItems {
  stepInMinutes?: number;
  // Selected item is time formatted as "00:00:00.000"
  selectedItem?: string | null; // This only applies on initialization, then the component will manage ongoing state
  onChange: (selectedItem: string | null) => void;
}

export const TimePicker: FunctionComponent<TimePickerProps> = (props) => {
  const { stepInMinutes = 15, selectedItem: initSelectedItem, placeholder = 'Select a time', onChange } = props;

  const [items, setItems] = useState(() => generateTimeListItems(stepInMinutes));
  const [initialSelectedItemIds] = useState(() => (initSelectedItem ? [normalizeInitialTime(initSelectedItem, stepInMinutes)] : undefined));

  useNonInitialEffect(() => setItems(generateTimeListItems(stepInMinutes)), [stepInMinutes]);

  function handleChange(selectedItems: ListItem[]) {
    if (Array.isArray(selectedItems) && selectedItems.length > 0) {
      onChange(selectedItems[0].value);
    } else {
      onChange(null);
    }
  }

  return (
    <Picklist
      {...props}
      placeholder={placeholder}
      dropdownIcon="clock"
      items={items}
      selectedItemIds={initialSelectedItemIds}
      onChange={handleChange}
    />
  );
};

export default TimePicker;
