import { DATE_FORMATS } from '@jetstream/shared/constants';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import formatDate from 'date-fns/format';
import parseDate from 'date-fns/parse';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import fileSizeFormatter from 'filesize';
import isDate from 'lodash/isDate';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import { SalesforceAddressField, SalesforceLocationField } from './data-table-types';

export const dataTableDateFormatter = (dateOrDateTime: Date | string | null | undefined): string => {
  try {
    if (!dateOrDateTime) {
      return null;
    } else if (isDate(dateOrDateTime)) {
      return formatDate(dateOrDateTime as Date, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a);
    } else if (dateOrDateTime.length === 28) {
      return formatDate(parseISO(dateOrDateTime), DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a);
    } else if (dateOrDateTime.length === 10) {
      return formatDate(startOfDay(parseISO(dateOrDateTime)), DATE_FORMATS.yyyy_MM_dd);
    } else {
      return dateOrDateTime;
    }
  } catch (ex) {
    logErrorToRollbar(ex.message, {
      stack: ex.stack,
      place: 'dataTableDateFormatter',
      type: 'Error formatting date',
      inputValue: dateOrDateTime,
    });
    return String(dateOrDateTime || '');
  }
};

export const dataTableTimeFormatter = (value: string | null | undefined): string => {
  try {
    const time: string = value;
    if (!time) {
      return null;
    } else if (time.length === 13) {
      return formatDate(parseDate(time, DATE_FORMATS.HH_mm_ss_ssss_z, new Date()), DATE_FORMATS.HH_MM_SS_a);
    } else {
      return time;
    }
  } catch (ex) {
    logErrorToRollbar(ex.message, {
      stack: ex.stack,
      place: 'dataTableDateFormatter',
      type: 'Error formatting time',
      inputValue: value,
    });
    return String(value || '');
  }
};

export const dataTableFileSizeFormatter = (sizeInBytes: string | number | null | undefined): string => {
  if (isNil(sizeInBytes)) {
    return null;
  }
  try {
    return fileSizeFormatter(sizeInBytes as any);
  } catch (ex) {
    logErrorToRollbar(ex.message, {
      stack: ex.stack,
      place: 'dataTableDateFormatter',
      type: 'error formatting file size',
      inputValue: sizeInBytes,
    });
    return String(sizeInBytes || '');
  }
};

const newLineRegex = /\\n/g;

export const dataTableAddressValueFormatter = (value: any): string => {
  try {
    if (!isObject(value)) {
      return null;
    }
    const address: SalesforceAddressField = value;
    const street = (address.street || '').replace(newLineRegex, '');
    const remainingParts = [address.city, address.state, address.postalCode, address.country].filter((part) => !!part).join(', ');
    return [street, remainingParts].join('\n');
  } catch (ex) {
    logErrorToRollbar(ex.message, {
      stack: ex.stack,
      place: 'dataTableDateFormatter',
      type: 'error formatting address',
      inputValue: value,
    });
    return String(value || '');
  }
};

export const dataTableLocationFormatter = (value: SalesforceLocationField | null | undefined): string => {
  try {
    if (!value || !isObject(value)) {
      return null;
    }
    const location: SalesforceLocationField = value as SalesforceLocationField;
    return `Latitude: ${location.latitude}°, Longitude: ${location.longitude}°`;
  } catch (ex) {
    logErrorToRollbar(ex.message, {
      stack: ex.stack,
      place: 'dataTableDateFormatter',
      type: 'error formatting location',
      inputValue: value,
    });
    return String(value || '');
  }
};
