import { xmlUtils } from '@jetstream/shared/ui-utils';
import { ensureArray } from '@jetstream/shared/utils';
import {
  ListItem,
  ListMetadataResult,
  ReadMetadataRecordType,
  ReadMetadataRecordTypeExtended,
  ReadMetadataRecordTypePicklistEntryExtended,
} from '@jetstream/types';
import JSZip from 'jszip';
import groupBy from 'lodash/groupBy';
import { RecordTypePicklistSummary } from '../types/record-types.types';

/**
 * Some fullName have invalid objects vs reality
 * Some picklist field names are different from metadadata API vs reality
 * Ensure array data types are consistent
 * @param record
 * @returns
 */
export function repairAndEnrichMetadata(record: ReadMetadataRecordType): ReadMetadataRecordTypeExtended {
  const [sobject, recordType] = getValidSobjectNameFromFullName(record.fullName);
  const picklistValues = ensureArray(record.picklistValues).map((picklistValues): ReadMetadataRecordTypePicklistEntryExtended => {
    const fieldName = getValidFieldNameName(decodeURIComponent(picklistValues.picklist));

    picklistValues.values = ensureArray(picklistValues.values);
    picklistValues.values.forEach((value) => {
      value.fullName = decodeURIComponent(value.fullName);
    });
    return {
      fieldName,
      ...picklistValues,
    };
  });
  return {
    sobject,
    recordType,
    ...record,
    picklistValues,
  };
}

function getValidSobjectNameFromFullName(fullName: string): [string, string] {
  const [sobject, recordType] = fullName.split('.');
  // TODO: are there other record types with one-off names?
  switch (sobject) {
    case 'PersonAccount':
      return ['Account', recordType];
    default:
      return [sobject, recordType];
  }
}

function getValidFieldNameName(metadataFieldName: string) {
  // TODO: are there other fields with one-off names?
  switch (metadataFieldName) {
    case 'Name':
      return 'Salutation';
    default:
      return metadataFieldName;
  }
}

export function getListItemFromRecordTypeMetadata(items: ListMetadataResult[]): ListItem[] {
  return items
    .filter((item) => !item.fullName.startsWith('Metric.'))
    .map((item): ListItem => {
      const [object, recordType] = item.fullName.split('.');
      return {
        id: item.fullName,
        label: recordType,
        value: item.fullName,
        secondaryLabel: object,
        secondaryLabelOnNewLine: true,
        meta: item,
      };
    });
}

/**
 * Repair record types that were modified to prepare for deployment (e.g. PersonAccount)
 */
function setOriginalMetadataSobjectName(modifiedValues: RecordTypePicklistSummary[]): RecordTypePicklistSummary[] {
  return modifiedValues.map((item) => {
    const [sobject] = item.recordTypeFullName.split('.');
    if (item.sobject !== sobject) {
      return {
        ...item,
        sobject,
      };
    }
    return item;
  });
}

function getRecordTypeModifiedData(
  recordType: ReadMetadataRecordTypeExtended,
  modifiedValues: RecordTypePicklistSummary[],
): ReadMetadataRecordTypeExtended {
  return {
    ...recordType,
    picklistValues: recordType.picklistValues
      .map((picklistValues) => {
        const modifiedValue = modifiedValues.find(({ field }) => picklistValues.fieldName === field);
        if (!modifiedValue) {
          return picklistValues;
        }
        const values = Array.from(modifiedValue.values);
        if (values.length === 0) {
          return null;
        }
        return {
          fieldName: picklistValues.fieldName,
          picklist: picklistValues.picklist,
          values: values.map((value) => ({
            fieldName: '',
            fullName: value,
            default: modifiedValue.defaultValue === value ? 'true' : 'false',
          })),
        };
      })
      .filter(Boolean) as ReadMetadataRecordTypePicklistEntryExtended[],
  };
}

export async function prepareRecordTypeMetadataPackage({
  apiVersion,
  recordTypesByFullName,
  modifiedValues,
}: {
  apiVersion: string;
  recordTypesByFullName: Record<string, ReadMetadataRecordTypeExtended>;
  modifiedValues: RecordTypePicklistSummary[];
}) {
  modifiedValues = setOriginalMetadataSobjectName(modifiedValues);
  const zipFile = JSZip();

  const modifiedRecordTypes = Array.from(
    new Set(modifiedValues.map(({ recordTypeFullName }) => recordTypesByFullName[recordTypeFullName])),
  );
  const packageXml = xmlUtils.generatePackageXml(apiVersion, { RecordType: modifiedRecordTypes.map(({ fullName }) => fullName) });
  zipFile.file('package.xml', packageXml);

  const objectFolder = zipFile.folder('objects');
  if (objectFolder) {
    Object.entries(groupBy(modifiedValues, 'sobject')).forEach(([sobject, modifiedValuesForObject]) => {
      const recordTypes = Object.entries(groupBy(modifiedValuesForObject, 'recordTypeFullName')).map(
        ([recordTypeFullName, modifiedValuesForRecordType]) => {
          return getRecordTypeModifiedData(recordTypesByFullName[recordTypeFullName], modifiedValuesForRecordType);
        },
      );
      const objectXml = getObjectWithRecordTypesXml(recordTypes);
      objectFolder.file(`${sobject}.object`, objectXml);
    });
  }

  const file = await zipFile.generateAsync({ type: 'arraybuffer' });

  return file;
}

// This is all record types for an object
export function getObjectWithRecordTypesXml(recordTypes: ReadMetadataRecordTypeExtended[]) {
  return xmlUtils.buildMetadataXml('CustomObject', { recordTypes: recordTypes.map(getRecordTypeXmlContent) });
}

// this is one record type within an object
function getRecordTypeXmlContent(recordType: ReadMetadataRecordTypeExtended) {
  return {
    fullName: recordType.recordType,
    active: recordType.active,
    businessProcess: recordType.businessProcess || undefined,
    description: recordType.description || undefined,
    label: recordType.label,
    picklistValues: recordType.picklistValues.map(({ picklist, values }) => ({
      picklist,
      // only include what the metadata api expects, values may have additional properties
      values: values.map(({ fullName, default: isDefault }) => ({ fullName, default: isDefault })),
    })),
  };
}
