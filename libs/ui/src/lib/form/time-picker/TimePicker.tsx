/* eslint-disable jsx-a11y/anchor-is-valid */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem } from '@jetstream/types';
import addMinutes from 'date-fns/addMinutes';
import formatDate from 'date-fns/format';
import isSameDay from 'date-fns/isSameDay';
import parseDate from 'date-fns/parse';
import React, { FunctionComponent, useState } from 'react';
import Picklist, { PicklistProps } from '../picklist/Picklist';

export type PicklistPropsWithoutItems = Omit<
  PicklistProps,
  'items' | 'groups' | 'selectedItems' | 'selectedItemIds' | 'multiSelection' | 'omitMultiSelectPills' | 'onChange'
>;

// attribution: https://github.com/salesforce/design-system-react/blob/master/components/time-picker/index.jsx
function generateTimeListItems(stepInMinutes: number) {
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

    return `${hour}:${min}:00.000`;
  } catch (ex) {
    return time;
  }
}

export interface TimePickerProps extends PicklistPropsWithoutItems {
  stepInMinutes?: number;
  // Selected item is time formatted as "00:00:00.000"
  selectedItem?: string; // This only applies on initialization, then the component will manage ongoing state
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
