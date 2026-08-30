import { ListItem } from '@jetstream/types';
import { addMinutes } from 'date-fns/addMinutes';
import { formatDate } from 'date-fns/format';
import { isSameDay } from 'date-fns/isSameDay';
import { parse as parseDate } from 'date-fns/parse';
import { FunctionComponent, useMemo } from 'react';
import { ComboboxSharedProps } from '../combobox/Combobox';
import { ComboboxWithItems } from '../combobox/ComboboxWithItems';

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
    let [hour, min] = time.split(':').map((item) => Number(item));
    const remainder = min % stepInMinutes;
    if (remainder !== 0) {
      if (remainder < stepInMinutes / 2) {
        min = min - remainder;
        if (min < 0) {
          min = 0;
        }
      } else {
        min = min + (stepInMinutes - remainder);
        if (min >= 60) {
          min = 0;
          hour = (hour + 1) % 24;
        }
      }
    }

    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000`;
  } catch {
    return time;
  }
}

export interface TimePickerProps extends Omit<ComboboxSharedProps, 'onClear' | 'onClose'> {
  /** Applied to the combobox input, so external `htmlFor`/test selectors keep working */
  id?: string;
  stepInMinutes?: number;
  // Selected item is time formatted as "00:00:00.000"
  selectedItem?: string | null;
  onChange: (selectedItem: string | null) => void;
}

/**
 * Combobox of generated time options: the user can type to filter (e.g. "9:30" or "930") and press
 * Enter or pick from the list. Replaces the earlier select-only Picklist implementation, which was
 * unusable by typing and painful at small step sizes (stepInMinutes=1 renders 1,440 options).
 */
export const TimePicker: FunctionComponent<TimePickerProps> = ({
  id,
  stepInMinutes = 15,
  selectedItem,
  placeholder = 'Select a time',
  onChange,
  ...comboboxProps
}) => {
  const items = useMemo(() => generateTimeListItems(stepInMinutes), [stepInMinutes]);
  const selectedItemId = selectedItem ? normalizeInitialTime(selectedItem, stepInMinutes) : null;

  return (
    <ComboboxWithItems
      comboboxProps={{
        ...comboboxProps,
        inputProps: id ? { ...comboboxProps.inputProps, id } : comboboxProps.inputProps,
        placeholder,
        // The old Picklist implementation deselected on re-click (allowDeselection); the combobox
        // equivalent is an explicit clear button, without which a chosen time could never be unset
        showClearButton: true,
        onClear: () => onChange(null),
      }}
      items={items}
      selectedItemId={selectedItemId}
      onSelected={(item) => onChange(item.id)}
    />
  );
};

export default TimePicker;
