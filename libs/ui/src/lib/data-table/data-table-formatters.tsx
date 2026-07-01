/* eslint-disable @typescript-eslint/no-explicit-any */
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { tracker } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { formatDate } from 'date-fns/format';
import { isValid as isDateValid } from 'date-fns/isValid';
import { parse as parseDate } from 'date-fns/parse';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { filesize as fileSizeFormatter } from 'filesize';
import isDate from 'lodash/isDate';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import { SalesforceAddressField, SalesforceLocationField } from './data-table-types';

export const dataTableDateFormatter = (dateOrDateTime: Maybe<Date | string>): string | null => {
  try {
    if (!dateOrDateTime) {
      return null;
    } else if (isDate(dateOrDateTime)) {
      // Guard against an invalid Date instance so formatDate never throws; fall back to the raw value (coerced to a
      // string) instead of null to stay consistent with the string branches and avoid hiding data.
      return isDateValid(dateOrDateTime) ? formatDate(dateOrDateTime, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a) : String(dateOrDateTime);
    } else if (dateOrDateTime.length === 28) {
      const parsedDateTime = parseISO(dateOrDateTime);
      return isDateValid(parsedDateTime) ? formatDate(parsedDateTime, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a) : dateOrDateTime;
    } else if (dateOrDateTime.length === 10) {
      // A 10-char value is assumed to be an ISO date, but values like "12/11/2023" (MM/DD/YYYY, e.g. from a
      // formula field) also match this length and are not parseable as ISO. Fall back to the raw value instead of throwing.
      const parsedDate = parseISO(dateOrDateTime);
      return isDateValid(parsedDate) ? formatDate(startOfDay(parsedDate), DATE_FORMATS.yyyy_MM_dd) : dateOrDateTime;
    } else {
      return dateOrDateTime;
    }
  } catch (ex) {
    tracker.warn(getErrorMessage(ex), ex, {
      place: 'dataTableDateFormatter',
      type: 'Error formatting date',
      inputValue: dateOrDateTime,
    });
    return String(dateOrDateTime || '');
  }
};

export const dataTableTimeFormatter = (value: Maybe<string>): string | null => {
  try {
    const time = value;
    if (!time) {
      return null;
    } else if (time.length === 13) {
      const parsedTime = parseDate(time, DATE_FORMATS.HH_mm_ss_ssss_z, new Date());
      return isDateValid(parsedTime) ? formatDate(parsedTime, DATE_FORMATS.HH_MM_SS_a) : time;
    } else {
      return time;
    }
  } catch (ex) {
    tracker.warn(getErrorMessage(ex), ex, {
      place: 'dataTableTimeFormatter',
      type: 'Error formatting time',
      inputValue: value,
    });
    return String(value || '');
  }
};

export const dataTableFileSizeFormatter = (sizeInBytes: Maybe<string | number>): string | null => {
  if (isNil(sizeInBytes)) {
    return null;
  }
  try {
    return fileSizeFormatter(sizeInBytes as any);
  } catch (ex) {
    tracker.warn(getErrorMessage(ex), ex, {
      place: 'dataTableFileSizeFormatter',
      type: 'error formatting file size',
      inputValue: sizeInBytes,
    });
    return String(sizeInBytes || '');
  }
};

const newLineRegex = /\\n/g;

export const dataTableAddressValueFormatter = (value: any): string | null => {
  try {
    if (!isObject(value)) {
      return null;
    }
    const address: SalesforceAddressField = value;
    const street = (address.street || '').replace(newLineRegex, '');
    const remainingParts = [address.city, address.state, address.postalCode, address.country].filter((part) => !!part).join(', ');
    return [street, remainingParts].join('\n');
  } catch (ex) {
    tracker.warn(getErrorMessage(ex), ex, {
      place: 'dataTableAddressValueFormatter',
      type: 'error formatting address',
      inputValue: value,
    });
    return String(value || '');
  }
};

export const dataTableLocationFormatter = (value: Maybe<SalesforceLocationField>): string | null => {
  try {
    if (!value || !isObject(value)) {
      return null;
    }
    const location: SalesforceLocationField = value as SalesforceLocationField;
    return `Latitude: ${location.latitude}°, Longitude: ${location.longitude}°`;
  } catch (ex) {
    tracker.warn(getErrorMessage(ex), ex, {
      place: 'dataTableLocationFormatter',
      type: 'error formatting location',
      inputValue: value,
    });
    return String(value || '');
  }
};
