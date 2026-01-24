import { logger } from '@jetstream/shared/client-logger';
import { listMetadata, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { toBoolean } from '@jetstream/shared/utils';
import { FileProperties, MetadataInfo, SalesforceOrgUi } from '@jetstream/types';
import { allFields, FieldValues } from '@jetstream/ui-core';
import JSZip from 'jszip';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import { convert as xmlConverter } from 'xmlbuilder2';
import { ExportOptions } from './sobject-export-types';

/**
 * CustomField metadata structure from Metadata API
 * This represents the subset of properties we care about
 */
interface CustomFieldMetadata extends MetadataInfo {
  fullName: string;
  label?: string;
  type?: string;
  inlineHelpText?: string;
  description?: string;
  length?: number;
  precision?: number;
  scale?: number;
  required?: boolean;
  unique?: boolean;
  externalId?: boolean;
  defaultValue?: string | boolean;
  referenceTo?: string | string[];
  deleteConstraint?: 'SetNull' | 'Cascade' | 'Restrict';
  relationshipName?: string;
  formula?: string;
  formulaTreatBlanksAs?: 'BlankAsZero' | 'Blanks';
  writeRequiresMasterRead?: boolean;
  reparentableMasterDetail?: boolean;
  visibleLines?: number;
  displayFormat?: string;
  startingNumber?: number;
  populateExistingRows?: boolean;
  displayLocationInDecimal?: boolean;
  maskChar?: string;
  maskType?: string;
  valueSet?: {
    valueSetName?: string;
    restricted?: boolean;
    valueSetDefinition?: {
      sorted?: boolean;
      value?: Array<{
        fullName: string;
        default?: boolean;
        label?: string;
      }>;
    };
  };
}

interface SobjectMetadataResult {
  sobject: string;
  fields?: CustomFieldMetadata[];
  error?: string;
}

/**
 * Fetches CustomField metadata for selected objects using Metadata API
 */
export async function getCustomFieldMetadata(org: SalesforceOrgUi, selectedSobjects: string[]): Promise<SobjectMetadataResult[]> {
  const customFieldsSet = new Set(selectedSobjects);
  const customFields = await listMetadata(org, [{ type: 'CustomField' }]).then((items) =>
    items.data.filter((item) => customFieldsSet.has(item.fullName.split('.')[0])),
  );

  const id = (await retrieveMetadataFromListMetadata(org, { CustomField: customFields })).id;
  const results = await pollRetrieveMetadataResultsUntilDone(org, id);

  if (isString(results.zipFile)) {
    const salesforcePackage = await JSZip.loadAsync(results.zipFile, { base64: true });

    const contentByFilename = {} as Record<string, string>;

    async function populateContent(fileProperties: FileProperties) {
      if (contentByFilename[fileProperties.fileName]) {
        return;
      }
      const content = await salesforcePackage.file(fileProperties.fileName)?.async('string');
      if (!content) {
        return;
      }
      contentByFilename[fileProperties.fileName] = content;
    }

    await Promise.all((results.fileProperties || []).map((item) => populateContent(item)));

    // Parse XML and group fields by sobject
    const fieldsBySobject = new Map<string, CustomFieldMetadata[]>();

    Object.entries(contentByFilename).forEach(([fileName, content]) => {
      try {
        const xml = xmlConverter(content, { format: 'object', wellFormed: true }) as {
          CustomObject?: {
            fields?: CustomFieldMetadata | CustomFieldMetadata[];
          };
        };

        // Extract sobject name from filename (e.g., "objects/Account.object" -> "Account")
        const sobjectName = fileName.split('/').pop()?.replace('.object', '') || '';

        if (!sobjectName) {
          return;
        }

        // Extract fields from CustomObject
        const customObject = xml.CustomObject;
        if (!customObject || !customObject.fields) {
          return;
        }

        let fields = customObject.fields;

        // Handle both single field (object) and multiple fields (array)
        if (!Array.isArray(fields)) {
          fields = [fields];
        }

        // Convert each field to CustomFieldMetadata and add sobject prefix to fullName
        const customFields: CustomFieldMetadata[] = fields.map((field) => ({
          ...field,
          fullName: `${sobjectName}.${field.fullName}`,
        }));

        // Add to or merge with existing fields for this sobject
        const existingFields = fieldsBySobject.get(sobjectName) || [];
        fieldsBySobject.set(sobjectName, [...existingFields, ...customFields]);
      } catch (error) {
        logger.error(`Error parsing XML for ${fileName}:`, error);
      }
    });

    // Convert to SobjectMetadataResult array
    const metadataResults: SobjectMetadataResult[] = Array.from(fieldsBySobject.entries()).map(([sobject, fields]) => ({
      sobject,
      fields,
    }));

    return metadataResults;
  }
  throw new Error(results.errorMessage || 'No data was returned from Salesforce');
}

/**
 * Transforms CustomField metadata to FieldValues format for Create Fields import template
 */
export function transformMetadataToFieldValues(metadata: CustomFieldMetadata, key: number): FieldValues {
  // Strip object prefix and __c suffix from fullName
  // Example: Account.CustomField__c → CustomField
  const fullNameParts = metadata.fullName.split('.');
  const fieldApiName = fullNameParts[fullNameParts.length - 1];
  const cleanFieldName = fieldApiName.endsWith('__c') ? fieldApiName.slice(0, -3) : fieldApiName;

  // Determine if this is a formula field - if so, swap type handling
  const isFormula = Boolean(metadata.formula);
  const fieldType = isFormula ? 'Formula' : metadata.type || 'Text';
  const secondaryType = isFormula ? metadata.type || 'Text' : 'Text';

  // Handle picklist values
  let valueSetString = '';
  let globalValueSetName = '';
  let picklistGlobalValueSet = false;
  let firstAsDefault = false;
  let restricted = false;

  if (metadata.valueSet) {
    if (metadata.valueSet.valueSetName) {
      // Global picklist
      globalValueSetName = metadata.valueSet.valueSetName;
      picklistGlobalValueSet = true;
    } else if (metadata.valueSet.valueSetDefinition?.value) {
      // Custom picklist values - convert to newline-separated string
      valueSetString = metadata.valueSet.valueSetDefinition.value.map((v) => v.fullName).join('\n');
      restricted = metadata.valueSet.restricted || false;
      // Check if first value is default
      firstAsDefault = metadata.valueSet.valueSetDefinition.value[0]?.default || false;
      picklistGlobalValueSet = false;
    }
  }

  // Calculate precision for template (metadata returns combined precision)
  const templatePrecision = !isNil(metadata.precision) && !isNil(metadata.scale) ? String(metadata.precision - metadata.scale) : '';
  const templateScale = !isNil(metadata.scale) ? String(metadata.scale) : '';

  // Handle referenceTo - can be string or array
  const referenceToValue = Array.isArray(metadata.referenceTo) ? metadata.referenceTo[0] || '' : metadata.referenceTo || '';
  const fieldValueCommon = { touched: true, isValid: true, errorMessage: null };
  // Create FieldValues structure matching Create Fields format
  const fieldValues: FieldValues = {
    _key: key,
    _allValid: true,
    _picklistGlobalValueSet: picklistGlobalValueSet,
    type: { value: fieldType, ...fieldValueCommon },
    label: { value: metadata.label || '', ...fieldValueCommon },
    fullName: { value: cleanFieldName, ...fieldValueCommon },
    inlineHelpText: { value: metadata.inlineHelpText || '', ...fieldValueCommon },
    description: { value: metadata.description || '', ...fieldValueCommon },
    defaultValue: { value: metadata.defaultValue !== undefined ? metadata.defaultValue : '', ...fieldValueCommon },
    referenceTo: { value: referenceToValue, ...fieldValueCommon },
    deleteConstraint: { value: metadata.deleteConstraint || 'SetNull', ...fieldValueCommon },
    length: { value: String(metadata.length || 255), ...fieldValueCommon },
    precision: { value: templatePrecision, ...fieldValueCommon },
    scale: { value: templateScale, ...fieldValueCommon },
    required: { value: toBoolean(metadata.required) || false, ...fieldValueCommon },
    unique: { value: toBoolean(metadata.unique) || false, ...fieldValueCommon },
    externalId: { value: toBoolean(metadata.externalId) || false, ...fieldValueCommon },
    valueSet: { value: valueSetString, ...fieldValueCommon },
    globalValueSet: { value: globalValueSetName, ...fieldValueCommon },
    firstAsDefault: { value: firstAsDefault, ...fieldValueCommon },
    restricted: { value: toBoolean(restricted), ...fieldValueCommon },
    visibleLines: { value: String(metadata.visibleLines || 3), ...fieldValueCommon },
    startingNumber: { value: String(metadata.startingNumber || 0), ...fieldValueCommon },
    displayFormat: { value: metadata.displayFormat || '', ...fieldValueCommon },
    populateExistingRows: { value: toBoolean(metadata.populateExistingRows) || false, ...fieldValueCommon },
    formula: { value: metadata.formula || '', ...fieldValueCommon },
    formulaTreatBlanksAs: { value: toBoolean(metadata.formulaTreatBlanksAs) || 'Blanks', ...fieldValueCommon },
    secondaryType: { value: secondaryType, ...fieldValueCommon },
    writeRequiresMasterRead: { value: toBoolean(metadata.writeRequiresMasterRead) ? 'true' : 'false', ...fieldValueCommon },
    reparentableMasterDetail: { value: toBoolean(metadata.reparentableMasterDetail) || false, ...fieldValueCommon },
    relationshipName: { value: metadata.relationshipName || '', ...fieldValueCommon },
    displayLocationInDecimal: { value: toBoolean(metadata.displayLocationInDecimal) || false, ...fieldValueCommon },
    maskChar: { value: metadata.maskChar || '', ...fieldValueCommon },
    maskType: { value: metadata.maskType || '', ...fieldValueCommon },
  };

  return fieldValues;
}

/**
 * Prepares metadata export in Create Fields import template format
 */
export async function prepareMetadataExport(
  org: SalesforceOrgUi,
  selectedSobjects: string[],
  options: ExportOptions,
): Promise<Record<string, any[]>> {
  // Fetch metadata for all selected objects
  const metadataResults = await getCustomFieldMetadata(org, selectedSobjects);

  // Transform to FieldValues
  const errors: Array<{ sobject: string; error: string }> = [];

  // Apply worksheet layout
  const output: Record<string, any[]> = {};

  if (options.worksheetLayout === 'combined') {
    const exportRows: Record<string, any>[] = [];
    metadataResults.forEach((result) => {
      if (result.error) {
        errors.push({ sobject: result.sobject, error: result.error });
      } else if (result.fields) {
        result.fields.forEach((field, index) => {
          const fieldValues = transformMetadataToFieldValues(field, exportRows.length + index);
          exportRows.push(
            allFields.reduce(
              (acc, field) => {
                acc[field] = fieldValues[field].value;
                return acc;
              },
              { object: result.sobject } as Record<string, any>,
            ),
          );
        });
      }
    });
    // All fields on one worksheet
    output['Field Metadata'] = exportRows;
  } else {
    // Split by object - group fields by object
    metadataResults.forEach((result) => {
      if (result.fields && result.fields.length > 0) {
        const objectFields = result.fields.map((field, index) => {
          const fieldValues = transformMetadataToFieldValues(field, index);
          return allFields.reduce(
            (acc, field) => {
              acc[field] = fieldValues[field].value;
              return acc;
            },
            { object: result.sobject } as Record<string, any>,
          );
        });
        // Limit worksheet name to 31 characters (Excel limit)
        const worksheetName = result.sobject.substring(0, 31);
        output[worksheetName] = objectFields;
      }
    });
  }

  // Add errors worksheet if any
  if (errors.length > 0) {
    output['ERRORS'] = errors;
  }

  return output;
}
