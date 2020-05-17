// https://github.com/tannerlinsley/react-table/blob/127a7fca8754f6289b6bc019dbd1fc4bcdd13187/src/sortTypes.js
// Added support for objects and normalized to lowercase
import { SortByFn } from 'react-table';

const reSplitAlphaNumeric = /([0-9]+)/gm;

// Mixed sorting is slow, but very inclusive of many edge cases.
// It handles numbers, mixed alphanumeric combinations, and even
// null, undefined, and Infinity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const alphanumeric: SortByFn<any> = (rowA, rowB, columnId) => {
  let a = getRowValueByColumnID(rowA, columnId);
  let b = getRowValueByColumnID(rowB, columnId);
  // Force to strings (or "" for unsupported types)
  a = toString(a).toLowerCase();
  b = toString(b).toLowerCase();

  // Split on number groups, but keep the delimiter
  // Then remove falsey split values
  a = a.split(reSplitAlphaNumeric).filter(Boolean);
  b = b.split(reSplitAlphaNumeric).filter(Boolean);

  // While
  while (a.length && b.length) {
    const aa = a.shift();
    const bb = b.shift();

    const an = parseInt(aa, 10);
    const bn = parseInt(bb, 10);

    const combo = [an, bn].sort();

    // Both are string
    if (isNaN(combo[0])) {
      if (aa > bb) {
        return 1;
      }
      if (bb > aa) {
        return -1;
      }
      continue;
    }

    // One is a string, one is a number
    if (isNaN(combo[1])) {
      return isNaN(an) ? -1 : 1;
    }

    // Both are numbers
    if (an > bn) {
      return 1;
    }
    if (bn > an) {
      return -1;
    }
  }

  return a.length - b.length;
};

// Utils

function getRowValueByColumnID(row, columnId) {
  return row.values[columnId];
}

function toString(a) {
  if (typeof a === 'number') {
    if (isNaN(a) || a === Infinity || a === -Infinity) {
      return '';
    }
    return String(a);
  }
  if (typeof a === 'string') {
    return a;
  }
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a);
    } catch (ex) {
      return '';
    }
  }
  return '';
}
